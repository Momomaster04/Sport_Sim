import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { roundRobin } from './schedule';
import { rankRows } from './standings';
import { emptyRow } from './standings';

describe('Rng', () => {
  it('replays the same sequence for the same seed', () => {
    const first = Array.from({ length: 50 }, () => new Rng('abc').next());
    expect(new Set(first).size).toBe(1);

    const a = new Rng('season-1');
    const b = new Rng('season-1');
    expect(Array.from({ length: 100 }, () => a.next())).toEqual(
      Array.from({ length: 100 }, () => b.next()),
    );
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng('season-1').next();
    const b = new Rng('season-2').next();
    expect(a).not.toBe(b);
  });

  it('stays inside its bounds', () => {
    const rng = new Rng(7);
    for (let i = 0; i < 2000; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(rng.int(1, 6)).toBeGreaterThanOrEqual(1);
      expect(rng.int(1, 6)).toBeLessThanOrEqual(6);
    }
  });

  it('keeps every element when shuffling', () => {
    const rng = new Rng('shuffle');
    const input = Array.from({ length: 20 }, (_, i) => i);
    const shuffled = rng.shuffle(input);
    expect(shuffled).toHaveLength(20);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
  });

  it('respects weights', () => {
    const rng = new Rng('weighted');
    const counts = { heavy: 0, light: 0 };
    for (let i = 0; i < 4000; i += 1) {
      const pick = rng.weighted(
        [{ name: 'heavy' as const, w: 9 }, { name: 'light' as const, w: 1 }],
        (item) => item.w,
      );
      counts[pick.name] += 1;
    }
    // Expect roughly 9:1; allow generous slack so the test never flakes.
    expect(counts.heavy).toBeGreaterThan(counts.light * 5);
  });
});

describe('roundRobin', () => {
  const ids = Array.from({ length: 20 }, (_, i) => `t${i + 1}`);

  it('schedules a full double round robin', () => {
    const fixtures = roundRobin(ids, true);
    expect(fixtures).toHaveLength(380);
    expect(Math.max(...fixtures.map((f) => f.round))).toBe(38);
  });

  it('has every team play every other team exactly twice', () => {
    const fixtures = roundRobin(ids, true);
    const meetings = new Map<string, number>();

    for (const fixture of fixtures) {
      const [home, away] = fixture.competitorIds as [string, string];
      const key = [home, away].sort().join('|');
      meetings.set(key, (meetings.get(key) ?? 0) + 1);
    }

    expect(meetings.size).toBe((20 * 19) / 2);
    for (const count of meetings.values()) expect(count).toBe(2);
  });

  it('gives every team one fixture per round', () => {
    const fixtures = roundRobin(ids, true);
    for (let round = 1; round <= 38; round += 1) {
      const playing = fixtures
        .filter((f) => f.round === round)
        .flatMap((f) => f.competitorIds);
      expect(new Set(playing).size).toBe(20);
    }
  });

  it('balances home and away fixtures', () => {
    const fixtures = roundRobin(ids, true);
    for (const id of ids) {
      const home = fixtures.filter((f) => f.competitorIds[0] === id).length;
      const away = fixtures.filter((f) => f.competitorIds[1] === id).length;
      expect(home).toBe(19);
      expect(away).toBe(19);
    }
  });

  it('handles an odd number of competitors with byes', () => {
    const fixtures = roundRobin(['a', 'b', 'c'], false);
    expect(fixtures).toHaveLength(3);
    const playing = fixtures.flatMap((f) => f.competitorIds);
    expect(playing).not.toContain('__bye__');
  });

  it('returns nothing for fewer than two competitors', () => {
    expect(roundRobin(['solo'], true)).toEqual([]);
  });
});

describe('rankRows', () => {
  it('sorts by points then the given tie-breaks', () => {
    const rows = [
      { ...emptyRow('low', ['gd']), points: 3, columns: { gd: 9 } },
      { ...emptyRow('high', ['gd']), points: 9, columns: { gd: 1 } },
      { ...emptyRow('mid', ['gd']), points: 3, columns: { gd: 12 } },
    ];

    const ranked = rankRows(rows, [{ key: 'points' }, { key: 'gd' }]);
    expect(ranked.map((row) => row.competitorId)).toEqual(['high', 'mid', 'low']);
    expect(ranked.map((row) => row.rank)).toEqual([1, 2, 3]);
  });
});
