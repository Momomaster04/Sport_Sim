import type { Competitor, LeagueTemplate, Player, PlayerPosition, SportId } from '@sportsim/core';
import { bundledLeagues } from '@sportsim/football';

const VERSION = 1;
const KEY = `sportsim:${VERSION}:datasets`;

const POSITIONS: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];

/** Datasets that ship with the app, which cannot be deleted or overwritten. */
export function builtInDatasets(sportId: SportId): LeagueTemplate[] {
  const all = sportId === 'football' ? bundledLeagues() : [];
  return all.map((league) => ({ ...league, custom: false }));
}

function readCustom(): LeagueTemplate[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Re-validate on read: stored data can predate a schema change.
    return parsed.flatMap((entry) => {
      const league = parseDataset(entry);
      return league ? [{ ...league, custom: true }] : [];
    });
  } catch {
    return [];
  }
}

function writeCustom(datasets: LeagueTemplate[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(datasets));
  } catch {
    // A full or unavailable store should not interrupt editing.
  }
}

/** Every dataset available for a sport: the bundled ones first, then yours. */
export function listDatasets(sportId: SportId): LeagueTemplate[] {
  const custom = readCustom().filter((league) => (league.sportId ?? 'football') === sportId);
  return [...builtInDatasets(sportId), ...custom];
}

export function findDataset(sportId: SportId, id: string): LeagueTemplate | undefined {
  return listDatasets(sportId).find((league) => league.id === id);
}

/** Save a dataset of your own, replacing any earlier version of it. */
export function saveDataset(league: LeagueTemplate): LeagueTemplate {
  const stored: LeagueTemplate = { ...league, custom: true };
  const rest = readCustom().filter((entry) => entry.id !== stored.id);
  writeCustom([...rest, stored]);
  return stored;
}

export function deleteDataset(id: string): void {
  writeCustom(readCustom().filter((entry) => entry.id !== id));
}

/** A unique id derived from a name, so two datasets never collide. */
function uniqueId(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'league';

  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Copy a dataset under a new name and season.
 *
 * This is the usual way to build a historical season: start from the closest
 * existing one, then edit the clubs and ratings rather than typing twenty
 * clubs and several hundred players from nothing.
 */
export function cloneDataset(source: LeagueTemplate, name: string, season: string): LeagueTemplate {
  const taken = new Set(listDatasets(source.sportId ?? 'football').map((entry) => entry.id));
  return {
    ...structuredClone(source),
    id: uniqueId(`${name}-${season}`, taken),
    name,
    season,
    custom: true,
  };
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRatings(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {};
  const ratings: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      ratings[key] = Math.min(99, Math.max(1, Math.round(raw)));
    }
  }
  return ratings;
}

function parsePlayer(value: unknown, index: number, clubId: string): Player | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return undefined;

  const position = POSITIONS.includes(raw.position as PlayerPosition)
    ? (raw.position as PlayerPosition)
    : 'MF';

  const player: Player = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : `${clubId}-p${index + 1}`,
    name: raw.name.trim().slice(0, 60),
    position,
    ratings: asRatings(raw.ratings),
  };

  if (typeof raw.number === 'number') player.number = Math.round(raw.number);
  if (typeof raw.age === 'number') player.age = Math.round(raw.age);
  if (raw.custom === true) player.custom = true;

  return player;
}

function parseCompetitor(value: unknown, index: number): Competitor | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== 'string' || raw.name.trim() === '') return undefined;

  const name = raw.name.trim().slice(0, 60);
  const id =
    typeof raw.id === 'string' && raw.id
      ? raw.id
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `club-${index + 1}`;

  const competitor: Competitor = {
    id,
    name,
    short: typeof raw.short === 'string' && raw.short ? raw.short.trim().slice(0, 4).toUpperCase() : name.slice(0, 3).toUpperCase(),
    ratings: asRatings(raw.ratings),
  };

  if (typeof raw.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(raw.color)) competitor.color = raw.color;
  if (Array.isArray(raw.squad)) {
    const squad = raw.squad.flatMap((entry, slot) => {
      const player = parsePlayer(entry, slot, id);
      return player ? [player] : [];
    });
    if (squad.length > 0) competitor.squad = squad;
  }

  return competitor;
}

/**
 * Turn unknown JSON into a dataset, or undefined if it cannot be one.
 *
 * Written defensively because the input is a file someone picked: anything
 * malformed is dropped rather than trusted, and missing optional fields fall
 * back to sensible defaults instead of failing the whole import.
 */
export function parseDataset(value: unknown): LeagueTemplate | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const raw = value as Record<string, unknown>;

  if (typeof raw.name !== 'string' || raw.name.trim() === '') return undefined;
  if (!Array.isArray(raw.competitors)) return undefined;

  const competitors = raw.competitors.flatMap((entry, index) => {
    const competitor = parseCompetitor(entry, index);
    return competitor ? [competitor] : [];
  });

  // A league needs at least two clubs to produce a single fixture.
  if (competitors.length < 2) return undefined;

  const name = raw.name.trim().slice(0, 60);
  const league: LeagueTemplate = {
    id:
      typeof raw.id === 'string' && raw.id
        ? raw.id
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'league',
    name,
    competitors,
    doubleRoundRobin: raw.doubleRoundRobin !== false,
  };

  if (typeof raw.season === 'string') league.season = raw.season.trim().slice(0, 20);
  if (typeof raw.sportId === 'string') league.sportId = raw.sportId as SportId;
  if (typeof raw.rounds === 'number') league.rounds = Math.round(asNumber(raw.rounds, 1));

  return league;
}

/** Pretty-printed JSON for download. */
export function exportDataset(league: LeagueTemplate): string {
  const { custom: _custom, ...rest } = league;
  return JSON.stringify(rest, null, 2);
}

/**
 * Read a dataset from JSON text and store it under a free id.
 *
 * Importing never overwrites an existing dataset: a clashing id gets a new
 * one, so bringing in a file twice gives two datasets rather than silently
 * replacing the one already there.
 */
export function importDataset(text: string): LeagueTemplate {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }

  const league = parseDataset(parsed);
  if (!league) {
    throw new Error('That file does not look like a league: it needs a name and at least two clubs.');
  }

  const sportId = league.sportId ?? 'football';
  const taken = new Set(listDatasets(sportId).map((entry) => entry.id));
  const id = taken.has(league.id) ? uniqueId(`${league.name}-${league.season ?? 'import'}`, taken) : league.id;

  return saveDataset({ ...league, id, sportId });
}
