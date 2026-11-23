/** The sports this project simulates. */
export type SportId = 'soccer' | 'nba' | 'nfl' | 'f1';

/**
 * Two shapes of competition:
 *  - 'pair'  two competitors meet in one fixture (soccer, NBA, NFL)
 *  - 'field' the whole field competes in one fixture (F1)
 */
export type FixtureFormat = 'pair' | 'field';

/**
 * Anything that can take part in a fixture: a club, a franchise, or a driver
 * and their car. Ratings are sport-defined keys on a 0-100 scale, so each
 * engine declares the keys it cares about and reads them back here.
 */
export interface Competitor {
  id: string;
  name: string;
  /** Two-to-four character abbreviation used in tables. */
  short: string;
  ratings: Record<string, number>;
  /** Hex colour used for charts and badges. */
  color?: string;
}

/** A scheduled contest awaiting simulation. */
export interface Fixture {
  id: string;
  /** Matchweek, game week, or race number, 1-indexed. */
  round: number;
  /**
   * Competitor ids in order. For 'pair' fixtures this is [home, away].
   * For 'field' fixtures it is the entry list.
   */
  competitorIds: string[];
  /** Pair fixtures only: suppress the home advantage term. */
  neutral?: boolean;
}

/** How one competitor got on in one fixture. */
export interface CompetitorResult {
  competitorId: string;
  /** Goals or points. Omitted by sports scored purely by finishing order. */
  score?: number;
  /** Finishing position, 1-indexed. Used by field sports. */
  position?: number;
  /** Retired or otherwise failed to finish. */
  dnf?: boolean;
  /** Sport-defined box score, e.g. shots, rebounds, pit stops. */
  stats: Record<string, number>;
}

/** A single thing that happened, used to drive the live play-by-play feed. */
export interface SimEvent {
  /** Elapsed clock in the sport's own units (minutes, seconds, laps). */
  t: number;
  /** Machine-readable kind, e.g. 'goal', 'turnover', 'pit'. */
  type: string;
  competitorId?: string;
  /** One-line description for the feed. */
  label: string;
  detail?: string;
  /** True for events that change the score, so the UI can highlight them. */
  scoring?: boolean;
}

/** The outcome of a simulated fixture. */
export interface FixtureResult {
  fixtureId: string;
  round: number;
  competitors: CompetitorResult[];
  events: SimEvent[];
  /** Set when the fixture is still in progress in live mode. */
  inProgress?: boolean;
}

/** A row of a league table or drivers' championship. */
export interface StandingsRow {
  competitorId: string;
  rank: number;
  played: number;
  points: number;
  /** Extra columns, keyed to match the sport's standingsColumns. */
  columns: Record<string, number>;
}

/** A column header for the standings table. */
export interface ColumnSpec {
  key: string;
  label: string;
  /** Longer description for tooltips. */
  title?: string;
}

/** A ready-made competition the user can load and play. */
export interface LeagueTemplate {
  id: string;
  name: string;
  competitors: Competitor[];
  /** Pair sports: whether every pairing is played home and away. */
  doubleRoundRobin: boolean;
  /** Field sports: how many rounds make up a season. */
  rounds?: number;
}
