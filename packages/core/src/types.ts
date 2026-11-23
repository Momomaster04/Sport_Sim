/** The sports this project simulates. */
export type SportId = 'football' | 'nba' | 'american-football' | 'f1';

/**
 * Two shapes of competition:
 *  - 'pair'  two competitors meet in one fixture (football, NBA, NFL)
 *  - 'field' the whole field competes in one fixture (F1)
 */
export type FixtureFormat = 'pair' | 'field';

/**
 * Where a player lines up. Sports that do not field positional squads simply
 * leave squads empty and the engines fall back to competitor-level ratings.
 */
export type PlayerPosition = 'GK' | 'DF' | 'MF' | 'FW';

/**
 * One member of a squad.
 *
 * Squads can be generated from a club's strength or typed in by hand. A player
 * carries sport-defined ratings on the same 0-100 scale as competitors, so an
 * engine reads whichever keys it declares and ignores the rest.
 */
export interface Player {
  id: string;
  name: string;
  position: PlayerPosition;
  ratings: Record<string, number>;
  /** Shirt number, where the sport uses them. */
  number?: number;
  /** Age in years, used for ageing and progression between seasons. */
  age?: number;
  /** True when a person entered this player rather than the generator. */
  custom?: boolean;
}

/**
 * Anything that can take part in a fixture: a club, a franchise, or a driver
 * and their car. Ratings are sport-defined keys on a 0-100 scale, so each
 * engine declares the keys it cares about and reads them back here.
 *
 * When a squad is present, engines derive effective strength from the players
 * and treat `ratings` as a fallback or an override.
 */
export interface Competitor {
  id: string;
  name: string;
  /** Two-to-four character abbreviation used in tables. */
  short: string;
  ratings: Record<string, number>;
  /** Hex colour used for charts and badges. */
  color?: string;
  squad?: Player[];
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

/** What one player did in one fixture. */
export interface PlayerStatLine {
  playerId: string;
  competitorId: string;
  /** Sport-defined keys, e.g. goals, assists, saves, minutes. */
  stats: Record<string, number>;
}

/** A single thing that happened, used to drive the live play-by-play feed. */
export interface SimEvent {
  /** Elapsed clock in the sport's own units (minutes, seconds, laps). */
  t: number;
  /** Machine-readable kind, e.g. 'goal', 'turnover', 'pit'. */
  type: string;
  competitorId?: string;
  /** The player responsible, where the engine tracks individuals. */
  playerId?: string;
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
  /** Per-player lines, where the engine tracks individuals. */
  players?: PlayerStatLine[];
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

/** A column header for a standings or stats table. */
export interface ColumnSpec {
  key: string;
  label: string;
  /** Longer description for tooltips. */
  title?: string;
}

/**
 * A competition that can be loaded and played.
 *
 * Datasets are scoped to a season so historical campaigns can sit alongside
 * the current one. They are plain data by design: a dataset can be bundled
 * with the app, edited in the browser, or imported from a JSON file without
 * any code change.
 */
export interface LeagueTemplate {
  id: string;
  name: string;
  /** The season this dataset represents, e.g. "2025/26". */
  season?: string;
  /** Which sport's engine plays this dataset. */
  sportId?: SportId;
  competitors: Competitor[];
  /** Pair sports: whether every pairing is played home and away. */
  doubleRoundRobin: boolean;
  /** Field sports: how many rounds make up a season. */
  rounds?: number;
  /** True when a person created or edited this dataset. */
  custom?: boolean;
}
