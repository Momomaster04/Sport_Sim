import type { Rng } from './rng';
import type {
  ColumnSpec,
  Competitor,
  Fixture,
  FixtureFormat,
  FixtureResult,
  LeagueTemplate,
  SimEvent,
  SportId,
} from './types';

/**
 * A fixture being simulated tick by tick, for the live play-by-play mode.
 *
 * Callers drive it with step() until done is true. Running it to completion
 * must give exactly the same result as the engine's own simulate(), so the
 * live view and a fast season sim never disagree.
 */
export interface LiveSim {
  /** Elapsed clock in the sport's units. */
  readonly clock: number;
  /** Clock value at which the fixture ends. */
  readonly duration: number;
  readonly done: boolean;
  /** Advance one tick and return any events that occurred. */
  step(): SimEvent[];
  /** The result as it currently stands. */
  snapshot(): FixtureResult;
}

/**
 * Everything a sport must provide to be playable in this app.
 *
 * Adding a sport means implementing this interface and nothing else: the
 * scheduler, season runner, standings view, live feed and sandbox all work off
 * these members alone.
 */
export interface SportDefinition {
  id: SportId;
  name: string;
  format: FixtureFormat;
  /** Label for the clock in the live feed, e.g. "min" or "lap". */
  clockUnit: string;
  /** What a score means in this sport, e.g. "Goals" or "Points". */
  scoreLabel: string;
  /** Ratings this engine reads, exposed as sliders in the sandbox. */
  ratingKeys: ColumnSpec[];
  /** Columns shown in the standings table, after played and points. */
  standingsColumns: ColumnSpec[];
  /** Columns shown in a fixture's box score. */
  boxScoreColumns: ColumnSpec[];
  /** Points awarded for a win, draw and loss, or per finishing position. */
  simulate(fixture: Fixture, competitors: Competitor[], rng: Rng): FixtureResult;
  createLive(fixture: Fixture, competitors: Competitor[], rng: Rng): LiveSim;
  /** Build the table from every result so far. Must be a pure function. */
  standings(results: FixtureResult[], competitors: Competitor[]): import('./types').StandingsRow[];
  /** The competition loaded when the user first opens this sport. */
  defaultLeague(): LeagueTemplate;
}

/**
 * Run a LiveSim to the final whistle.
 *
 * Engines whose fast path is just "play every tick" can implement simulate()
 * as a one-liner over this helper and stay guaranteed consistent with their
 * own live mode.
 */
export function runToCompletion(sim: LiveSim): FixtureResult {
  let guard = 0;
  while (!sim.done) {
    sim.step();
    guard += 1;
    if (guard > 100_000) throw new Error('Simulation failed to finish within 100000 ticks');
  }
  const result = sim.snapshot();
  return { ...result, inProgress: false };
}
