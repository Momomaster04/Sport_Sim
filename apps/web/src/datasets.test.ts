import { describe, expect, it } from 'vitest';
import { exportDataset, parseDataset } from './datasets';

const minimal = {
  name: 'Test League',
  competitors: [
    { name: 'Alpha FC', short: 'ALP', ratings: { attack: 80, midfield: 78, defence: 76 } },
    { name: 'Beta United', short: 'BET', ratings: { attack: 70, midfield: 71, defence: 72 } },
  ],
};

describe('parseDataset', () => {
  it('accepts a well formed league', () => {
    const league = parseDataset(minimal);
    expect(league?.name).toBe('Test League');
    expect(league?.competitors).toHaveLength(2);
    expect(league?.id).toBe('test-league');
    // Double round robin is the sensible default for a league.
    expect(league?.doubleRoundRobin).toBe(true);
  });

  it('rejects anything that is not a league', () => {
    for (const bad of [null, undefined, 42, 'league', [], {}, { name: 'No clubs' }]) {
      expect(parseDataset(bad)).toBeUndefined();
    }
  });

  it('rejects a league with fewer than two clubs', () => {
    expect(parseDataset({ name: 'Lonely', competitors: [minimal.competitors[0]] })).toBeUndefined();
  });

  it('drops malformed clubs rather than failing the whole import', () => {
    const league = parseDataset({
      name: 'Mixed',
      competitors: [...minimal.competitors, null, 'nonsense', { short: 'NAM' }, { name: '   ' }],
    });
    expect(league?.competitors).toHaveLength(2);
  });

  it('derives ids and abbreviations when they are missing', () => {
    const league = parseDataset({
      name: 'Derived',
      competitors: [{ name: 'Real Something' }, { name: 'Another Club' }],
    });
    expect(league?.competitors[0]?.id).toBe('real-something');
    expect(league?.competitors[0]?.short).toBe('REA');
  });

  it('clamps ratings into range and discards non numbers', () => {
    const league = parseDataset({
      name: 'Clamped',
      competitors: [
        { name: 'High', ratings: { attack: 400, midfield: -20, defence: 'nonsense' } },
        { name: 'Low', ratings: { attack: 50 } },
      ],
    });
    const high = league?.competitors[0];
    expect(high?.ratings.attack).toBe(99);
    expect(high?.ratings.midfield).toBe(1);
    expect(high?.ratings.defence).toBeUndefined();
  });

  it('only accepts a colour that looks like a hex value', () => {
    const league = parseDataset({
      name: 'Colours',
      competitors: [
        { name: 'Good', color: '#ff0000' },
        { name: 'Bad', color: 'javascript:alert(1)' },
      ],
    });
    expect(league?.competitors[0]?.color).toBe('#ff0000');
    expect(league?.competitors[1]?.color).toBeUndefined();
  });

  it('reads squads and defaults an unknown position to midfield', () => {
    const league = parseDataset({
      name: 'Squads',
      competitors: [
        {
          name: 'With Squad',
          squad: [
            { name: 'A Keeper', position: 'GK', ratings: { keeping: 80 } },
            { name: 'Odd Position', position: 'WIZARD' },
            { name: '', position: 'FW' },
          ],
        },
        { name: 'Without Squad' },
      ],
    });

    const squad = league?.competitors[0]?.squad;
    // The nameless player is dropped; the unknown position falls back.
    expect(squad).toHaveLength(2);
    expect(squad?.[0]?.position).toBe('GK');
    expect(squad?.[1]?.position).toBe('MF');
    expect(league?.competitors[1]?.squad).toBeUndefined();
  });

  it('keeps the season label and honours an explicit single round robin', () => {
    const league = parseDataset({ ...minimal, season: '2015/16', doubleRoundRobin: false });
    expect(league?.season).toBe('2015/16');
    expect(league?.doubleRoundRobin).toBe(false);
  });

  it('truncates absurdly long names', () => {
    const league = parseDataset({ ...minimal, name: 'x'.repeat(500) });
    expect(league?.name.length).toBe(60);
  });
});

describe('exportDataset', () => {
  it('round trips through JSON', () => {
    const league = parseDataset({ ...minimal, season: '2025/26' });
    const reparsed = parseDataset(JSON.parse(exportDataset(league!)));
    expect(reparsed).toEqual(league);
  });

  it('does not export the custom flag, so an import is judged on its own', () => {
    const league = { ...parseDataset(minimal)!, custom: true };
    expect(JSON.parse(exportDataset(league))).not.toHaveProperty('custom');
  });
});
