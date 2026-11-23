import { Rng } from './rng';
import { buildSchedule } from './schedule';
import type { SportDefinition } from './sport';
import type { Competitor, Fixture, FixtureResult, LeagueTemplate, SportId, StandingsRow } from './types';

/**
 * A season in progress. Treated as immutable: every operation returns a new
 * object, which keeps undo, save slots and React state updates trivial.
 */
export interface Season {
  sportId: SportId;
  leagueId: string;
  leagueName: string;
  /** The season the dataset represents, e.g. "2025/26". */
  leagueSeason?: string;
  /** Seeds every fixture in this season. Same seed, same season, every time. */
  seed: string;
  competitors: Competitor[];
  fixtures: Fixture[];
  results: FixtureResult[];
  /** The next round to be played, 1-indexed. */
  nextRound: number;
}

export interface CreateSeasonOptions {
  /** Defaults to the sport's own league. */
  league?: LeagueTemplate;
  /** Defaults to a random seed. */
  seed?: string;
}

/** Set up a fresh season for a sport. */
export function createSeason(sport: SportDefinition, options: CreateSeasonOptions = {}): Season {
  const league = options.league ?? sport.defaultLeague();
  const seed = options.seed ?? Math.random().toString(36).slice(2, 10);

  return {
    sportId: sport.id,
    leagueId: league.id,
    leagueName: league.name,
    ...(league.season ? { leagueSeason: league.season } : {}),
    seed,
    competitors: league.competitors,
    fixtures: buildSchedule(league, sport.format, seed),
    results: [],
    nextRound: 1,
  };
}

/** How many rounds the season runs for. */
export function totalRounds(season: Season): number {
  return season.fixtures.reduce((max, fixture) => Math.max(max, fixture.round), 0);
}

export function isComplete(season: Season): boolean {
  return season.nextRound > totalRounds(season);
}

export function fixturesForRound(season: Season, round: number): Fixture[] {
  return season.fixtures.filter((fixture) => fixture.round === round);
}

export function resultFor(season: Season, fixtureId: string): FixtureResult | undefined {
  return season.results.find((result) => result.fixtureId === fixtureId);
}

/**
 * The generator for one fixture.
 *
 * Deriving it from the season seed plus the fixture id — rather than threading
 * one generator through the whole season — means a fixture always plays out the
 * same way no matter what order rounds are simulated in, or how many times a
 * single match is replayed in live mode.
 */
export function fixtureRng(season: Season, fixtureId: string): Rng {
  return new Rng(`${season.seed}:${fixtureId}`);
}

/** Look up the competitors taking part in a fixture, in fixture order. */
export function competitorsFor(season: Season, fixture: Fixture): Competitor[] {
  return fixture.competitorIds.map((id) => {
    const competitor = season.competitors.find((entry) => entry.id === id);
    if (!competitor) throw new Error(`Fixture ${fixture.id} references unknown competitor ${id}`);
    return competitor;
  });
}

/** Simulate one fixture without recording it against the season. */
export function simulateFixture(
  sport: SportDefinition,
  season: Season,
  fixture: Fixture,
): FixtureResult {
  return sport.simulate(fixture, competitorsFor(season, fixture), fixtureRng(season, fixture.id));
}

/** Play the next unplayed round and return the updated season. */
export function playRound(sport: SportDefinition, season: Season): Season {
  if (isComplete(season)) return season;

  const round = season.nextRound;
  const played = fixturesForRound(season, round)
    .filter((fixture) => !resultFor(season, fixture.id))
    .map((fixture) => simulateFixture(sport, season, fixture));

  return {
    ...season,
    results: [...season.results, ...played],
    nextRound: round + 1,
  };
}

/** Record a result produced elsewhere, such as by the live view. */
export function recordResult(season: Season, result: FixtureResult): Season {
  const results = [
    ...season.results.filter((existing) => existing.fixtureId !== result.fixtureId),
    { ...result, inProgress: false },
  ];

  // Advance past any round that is now fully played.
  let nextRound = season.nextRound;
  const rounds = totalRounds(season);
  while (
    nextRound <= rounds &&
    fixturesForRound(season, nextRound).every((fixture) =>
      results.some((entry) => entry.fixtureId === fixture.id),
    )
  ) {
    nextRound += 1;
  }

  return { ...season, results, nextRound };
}

/** Play every remaining round. */
export function playSeason(sport: SportDefinition, season: Season): Season {
  let current = season;
  while (!isComplete(current)) {
    const before = current.nextRound;
    current = playRound(sport, current);
    if (current.nextRound === before) break;
  }
  return current;
}

/** The current table. */
export function standings(sport: SportDefinition, season: Season): StandingsRow[] {
  return sport.standings(season.results, season.competitors);
}
