import {
  Rng,
  createSeason,
  isComplete,
  playSeason,
  runToCompletion,
  standings,
  totalRounds,
  type Competitor,
  type Fixture,
} from '@sportsim/core';
import { describe, expect, it } from 'vitest';
import { SoccerMatch } from './engine';
import { soccer } from './index';

const fixture: Fixture = { id: 'test-match', round: 1, competitorIds: ['home', 'away'] };

function team(id: string, attack: number, midfield: number, defence: number): Competitor {
  return { id, name: id, short: id.slice(0, 3).toUpperCase(), ratings: { attack, midfield, defence } };
}

const even: Competitor[] = [team('home', 75, 75, 75), team('away', 75, 75, 75)];

function playMatch(seed: string, competitors = even) {
  return soccer.simulate(fixture, competitors, new Rng(seed));
}

describe('SoccerMatch', () => {
  it('is deterministic for a given seed', () => {
    expect(playMatch('match-42')).toEqual(playMatch('match-42'));
  });

  it('gives different matches for different seeds', () => {
    const scores = new Set(
      Array.from({ length: 20 }, (_, i) =>
        playMatch(`seed-${i}`)
          .competitors.map((side) => side.score)
          .join('-'),
      ),
    );
    // Twenty matches should not all end in the same scoreline.
    expect(scores.size).toBeGreaterThan(3);
  });

  it('produces a result the live feed agrees with', () => {
    // This is the contract that keeps the two modes honest: stepping a match
    // minute by minute must land on exactly what the fast sim would produce.
    const fast = soccer.simulate(fixture, even, new Rng('consistency'));

    const live = soccer.createLive(fixture, even, new Rng('consistency'));
    const collected = [];
    while (!live.done) collected.push(...live.step());

    expect(live.snapshot().competitors).toEqual(fast.competitors);
    expect(collected).toEqual(fast.events);
  });

  it('reports a finished match as not in progress', () => {
    const result = playMatch('finished');
    expect(result.inProgress).toBe(false);
    expect(result.events.at(-1)?.type).toBe('fulltime');
  });

  it('runs for ninety minutes plus added time', () => {
    const match = new SoccerMatch(fixture, even, new Rng('clock'));
    expect(match.duration).toBeGreaterThanOrEqual(92);
    expect(match.duration).toBeLessThanOrEqual(96);

    runToCompletion(match);
    expect(match.clock).toBe(match.duration);
  });

  it('emits a half time event on the stroke of 45', () => {
    const half = playMatch('halftime').events.filter((event) => event.type === 'halftime');
    expect(half).toHaveLength(1);
    expect(half[0]?.t).toBe(45);
  });

  it('keeps the box score internally consistent', () => {
    for (let i = 0; i < 100; i += 1) {
      const result = playMatch(`box-${i}`);

      for (const side of result.competitors) {
        const score = side.score ?? 0;
        // Every goal is also a shot on target, and every shot on target a shot.
        expect(side.stats.sot ?? 0).toBeGreaterThanOrEqual(score);
        expect(side.stats.shots ?? 0).toBeGreaterThanOrEqual(side.stats.sot ?? 0);
        expect(side.stats.yellow ?? 0).toBeGreaterThanOrEqual(0);
      }

      const possession = result.competitors.reduce((sum, side) => sum + (side.stats.possession ?? 0), 0);
      expect(possession).toBeGreaterThanOrEqual(99);
      expect(possession).toBeLessThanOrEqual(101);
    }
  });

  it('logs a goal event for every goal scored', () => {
    for (let i = 0; i < 50; i += 1) {
      const result = playMatch(`goals-${i}`);
      const scored = result.competitors.reduce((sum, side) => sum + (side.score ?? 0), 0);
      expect(result.events.filter((event) => event.type === 'goal')).toHaveLength(scored);
    }
  });
});

describe('soccer calibration', () => {
  const SAMPLE = 2000;

  it('lands total goals per game in a realistic band', () => {
    let goals = 0;
    for (let i = 0; i < SAMPLE; i += 1) {
      goals += playMatch(`cal-${i}`).competitors.reduce((sum, side) => sum + (side.score ?? 0), 0);
    }
    // Real top divisions sit around 2.6 to 2.8 goals a game.
    const perGame = goals / SAMPLE;
    expect(perGame).toBeGreaterThan(2.2);
    expect(perGame).toBeLessThan(3.2);
  });

  it('gives the home side an edge between evenly matched teams', () => {
    let homeWins = 0;
    let awayWins = 0;

    for (let i = 0; i < SAMPLE; i += 1) {
      const [home, away] = playMatch(`home-${i}`).competitors;
      const homeScore = home?.score ?? 0;
      const awayScore = away?.score ?? 0;
      if (homeScore > awayScore) homeWins += 1;
      if (awayScore > homeScore) awayWins += 1;
    }

    expect(homeWins).toBeGreaterThan(awayWins);
    // The edge should be an edge, not a guarantee.
    expect(awayWins / SAMPLE).toBeGreaterThan(0.2);
  });

  it('lets the stronger side win far more often', () => {
    const lopsided = [team('home', 90, 90, 88), team('away', 60, 60, 58)];
    let strongWins = 0;

    for (let i = 0; i < SAMPLE; i += 1) {
      const [home, away] = playMatch(`gap-${i}`, lopsided).competitors;
      if ((home?.score ?? 0) > (away?.score ?? 0)) strongWins += 1;
    }

    const rate = strongWins / SAMPLE;
    expect(rate).toBeGreaterThan(0.55);
    // Even a heavy favourite has to drop points sometimes.
    expect(rate).toBeLessThan(0.95);
  });

  it('shows possession tracking the midfield rating', () => {
    const midfieldGap = [team('home', 75, 90, 75), team('away', 75, 60, 75)];
    let homePossession = 0;

    for (let i = 0; i < 500; i += 1) {
      homePossession += playMatch(`poss-${i}`, midfieldGap).competitors[0]?.stats.possession ?? 0;
    }

    expect(homePossession / 500).toBeGreaterThan(55);
  });
});

describe('soccer season', () => {
  it('plays a full twenty team season', () => {
    const season = playSeason(soccer, createSeason(soccer, { seed: 'season-test' }));

    expect(totalRounds(season)).toBe(38);
    expect(season.fixtures).toHaveLength(380);
    expect(season.results).toHaveLength(380);
    expect(isComplete(season)).toBe(true);
  });

  it('builds a table that adds up', () => {
    const season = playSeason(soccer, createSeason(soccer, { seed: 'table-test' }));
    const table = standings(soccer, season);

    expect(table).toHaveLength(20);
    for (const row of table) expect(row.played).toBe(38);

    const goalsFor = table.reduce((sum, row) => sum + (row.columns.gf ?? 0), 0);
    const goalsAgainst = table.reduce((sum, row) => sum + (row.columns.ga ?? 0), 0);
    expect(goalsFor).toBe(goalsAgainst);

    // A decided match hands out 3 points; a draw splits 2 between the sides.
    const draws = table.reduce((sum, row) => sum + (row.columns.d ?? 0), 0) / 2;
    const points = table.reduce((sum, row) => sum + row.points, 0);
    expect(points).toBe((380 - draws) * 3 + draws * 2);

    expect(table[0]?.rank).toBe(1);
    expect(table[0]?.points).toBeGreaterThanOrEqual(table[19]?.points ?? 0);
  });

  it('replays a season identically from the same seed', () => {
    const first = playSeason(soccer, createSeason(soccer, { seed: 'repeat' }));
    const second = playSeason(soccer, createSeason(soccer, { seed: 'repeat' }));
    expect(standings(soccer, first)).toEqual(standings(soccer, second));
  });

  it('usually crowns one of the better rated sides', () => {
    const elite = new Set([
      'ashford-united',
      'kingsmead-city',
      'westmere-united',
      'stonehurst-rovers',
      'larkfield-albion',
    ]);
    let eliteTitles = 0;

    for (let i = 0; i < 20; i += 1) {
      const season = playSeason(soccer, createSeason(soccer, { seed: `title-${i}` }));
      const champion = standings(soccer, season)[0];
      if (champion && elite.has(champion.competitorId)) eliteTitles += 1;
    }

    expect(eliteTitles).toBeGreaterThanOrEqual(14);
  });
});
