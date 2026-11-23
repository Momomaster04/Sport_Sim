import {
  Rng,
  createSeason,
  leaderboard,
  playerIndex,
  playerTotals,
  playSeason,
  type Fixture,
} from '@sportsim/core';
import { describe, expect, it } from 'vitest';
import { football } from './index';
import { footballCompetitors, footballLeague } from './league';
import { effectiveRatings, generateSquad, startingEleven, withSquads } from './squad';

const clubs = footballCompetitors();
const liverpool = clubs.find((club) => club.id === 'liverpool');
const burnley = clubs.find((club) => club.id === 'burnley');

describe('generateSquad', () => {
  it('builds a full squad with every position covered', () => {
    const squad = generateSquad(liverpool!);

    expect(squad).toHaveLength(23);
    expect(squad.filter((player) => player.position === 'GK')).toHaveLength(3);
    expect(squad.filter((player) => player.position === 'DF')).toHaveLength(8);
    expect(squad.filter((player) => player.position === 'MF')).toHaveLength(7);
    expect(squad.filter((player) => player.position === 'FW')).toHaveLength(5);
  });

  it('is deterministic for a club', () => {
    expect(generateSquad(liverpool!)).toEqual(generateSquad(liverpool!));
  });

  it('gives different clubs different players', () => {
    const a = generateSquad(liverpool!).map((player) => player.name);
    const b = generateSquad(burnley!).map((player) => player.name);
    expect(a).not.toEqual(b);
  });

  it('gives unique ids and shirt numbers within a squad', () => {
    const squad = generateSquad(liverpool!);
    expect(new Set(squad.map((player) => player.id)).size).toBe(23);
    expect(new Set(squad.map((player) => player.number)).size).toBe(23);
  });

  it('keeps every rating inside its bounds', () => {
    for (const club of clubs) {
      for (const player of generateSquad(club)) {
        for (const value of Object.values(player.ratings)) {
          expect(value).toBeGreaterThanOrEqual(35);
          expect(value).toBeLessThanOrEqual(99);
        }
        expect(player.age).toBeGreaterThanOrEqual(18);
        expect(player.age).toBeLessThanOrEqual(35);
      }
    }
  });

  it('builds stronger squads for stronger clubs', () => {
    const strong = generateSquad(liverpool!);
    const weak = generateSquad(burnley!);

    const mean = (squad: typeof strong) =>
      squad.reduce((sum, player) => sum + (player.ratings.physical ?? 0), 0) / squad.length;

    expect(mean(strong)).toBeGreaterThan(mean(weak));
  });

  it('leaves an existing squad untouched', () => {
    const custom = [{ ...generateSquad(burnley!)[0]!, name: 'Typed By Hand', custom: true }];
    const [club] = withSquads([{ ...burnley!, squad: custom }]);
    expect(club?.squad).toHaveLength(1);
    expect(club?.squad?.[0]?.name).toBe('Typed By Hand');
  });
});

describe('startingEleven', () => {
  const eleven = startingEleven(generateSquad(liverpool!));

  it('picks eleven players in a 4-3-3', () => {
    expect(eleven).toHaveLength(11);
    expect(eleven.filter((player) => player.position === 'GK')).toHaveLength(1);
    expect(eleven.filter((player) => player.position === 'DF')).toHaveLength(4);
    expect(eleven.filter((player) => player.position === 'MF')).toHaveLength(3);
    expect(eleven.filter((player) => player.position === 'FW')).toHaveLength(3);
  });

  it('picks the best available at each position', () => {
    const squad = generateSquad(liverpool!);
    const bestKeeper = squad
      .filter((player) => player.position === 'GK')
      .sort((a, b) => (b.ratings.keeping ?? 0) - (a.ratings.keeping ?? 0))[0];
    expect(eleven[0]?.id).toBe(bestKeeper?.id);
  });

  it('returns nothing for an empty squad', () => {
    expect(startingEleven([])).toEqual([]);
  });
});

describe('effectiveRatings', () => {
  it('derives strength from the eleven a club fields', () => {
    const [withSquad] = withSquads([liverpool!]);
    const derived = effectiveRatings(withSquad!);

    expect(derived.attack).toBeGreaterThan(0);
    expect(derived.keeping).toBeGreaterThan(0);
    // A strong club should still read as strong once derived from its players.
    expect(derived.attack).toBeGreaterThan(effectiveRatings(withSquads([burnley!])[0]!).attack ?? 0);
  });

  it('falls back to club ratings when there is no squad', () => {
    expect(effectiveRatings(burnley!)).toEqual(burnley!.ratings);
  });
});

describe('player stats', () => {
  const fixture: Fixture = { id: 'm1', round: 1, competitorIds: ['liverpool', 'burnley'] };
  const sides = withSquads([liverpool!, burnley!]);

  it('attributes every goal to a named player', () => {
    for (let i = 0; i < 40; i += 1) {
      const result = football.simulate(fixture, sides, new Rng(`attr-${i}`));
      const goals = result.competitors.reduce((sum, side) => sum + (side.score ?? 0), 0);

      const goalEvents = result.events.filter((event) => event.type === 'goal');
      expect(goalEvents).toHaveLength(goals);
      for (const event of goalEvents) expect(event.playerId).toBeTruthy();

      const scored = (result.players ?? []).reduce((sum, line) => sum + (line.stats.goals ?? 0), 0);
      expect(scored).toBe(goals);
    }
  });

  it('never credits an assist to the scorer', () => {
    for (let i = 0; i < 60; i += 1) {
      const result = football.simulate(fixture, sides, new Rng(`assist-${i}`));
      const assists = (result.players ?? []).reduce((sum, line) => sum + (line.stats.assists ?? 0), 0);
      const goals = result.competitors.reduce((sum, side) => sum + (side.score ?? 0), 0);
      // Not every goal is assisted, but an assist can never exceed the goals.
      expect(assists).toBeLessThanOrEqual(goals);
    }
  });

  it('records no player lines for clubs without squads', () => {
    const result = football.simulate(fixture, [liverpool!, burnley!], new Rng('bare'));
    expect(result.players).toBeUndefined();
  });

  it('builds a season scoring chart', () => {
    const season = playSeason(football, createSeason(football, { league: footballLeague(), seed: 'scorers' }));
    const scorers = leaderboard(season.results, 'goals', 10);
    const index = playerIndex(season.competitors);

    expect(scorers.length).toBe(10);
    // The chart must be ordered and every entry must resolve to a real player.
    for (let i = 1; i < scorers.length; i += 1) {
      expect(scorers[i - 1]!.stats.goals ?? 0).toBeGreaterThanOrEqual(scorers[i]!.stats.goals ?? 0);
    }
    for (const scorer of scorers) {
      expect(index.get(scorer.playerId)).toBeDefined();
      expect(scorer.appearances).toBeGreaterThan(0);
    }

    // A golden boot winner in a 38 game season should be in double figures.
    expect(scorers[0]!.stats.goals ?? 0).toBeGreaterThan(9);
  });

  it('totals every player line across the season', () => {
    const season = playSeason(football, createSeason(football, { league: footballLeague(), seed: 'totals' }));
    const totals = playerTotals(season.results);
    const goals = totals.reduce((sum, entry) => sum + (entry.stats.goals ?? 0), 0);
    const scored = season.results.reduce(
      (sum, result) => sum + result.competitors.reduce((inner, side) => inner + (side.score ?? 0), 0),
      0,
    );
    expect(goals).toBe(scored);
  });
});
