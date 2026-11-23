import type { Season, SportId } from '@sportsim/core';

// Bumped whenever the saved shape changes, so a season saved against an older
// club list is discarded rather than restored against clubs that no longer
// exist.
const VERSION = 3;
const KEY_PREFIX = 'sportsim';

interface Envelope {
  version: number;
  season: Season;
}

/**
 * Seasons are keyed by dataset as well as sport, so playing 2015/16 does not
 * overwrite an in-progress 2025/26.
 */
function seasonKey(sportId: SportId, leagueId: string): string {
  return `${KEY_PREFIX}:${VERSION}:season:${sportId}:${leagueId}`;
}

function selectionKey(sportId: SportId): string {
  return `${KEY_PREFIX}:${VERSION}:selected:${sportId}`;
}

/**
 * Read a saved season.
 *
 * Every access is guarded: storage can be unavailable in a private window, and
 * a saved payload can predate a schema change. Either way the app should fall
 * back to a fresh season rather than fail to load.
 */
export function loadSeason(sportId: SportId, leagueId: string): Season | undefined {
  try {
    const raw = window.localStorage.getItem(seasonKey(sportId, leagueId));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Envelope;
    if (parsed.version !== VERSION) return undefined;

    const season = parsed.season;
    if (season?.sportId !== sportId || season.leagueId !== leagueId) return undefined;
    if (!Array.isArray(season.fixtures) || !Array.isArray(season.results)) return undefined;
    if (!Array.isArray(season.competitors) || season.competitors.length < 2) return undefined;

    return season;
  } catch {
    return undefined;
  }
}

export function saveSeason(season: Season): void {
  try {
    const envelope: Envelope = { version: VERSION, season };
    window.localStorage.setItem(seasonKey(season.sportId, season.leagueId), JSON.stringify(envelope));
  } catch {
    // A full or unavailable store should never interrupt a simulation.
  }
}

export function clearSeason(sportId: SportId, leagueId: string): void {
  try {
    window.localStorage.removeItem(seasonKey(sportId, leagueId));
  } catch {
    // Nothing to do if storage is unavailable.
  }
}

/** Remember which dataset was last open for a sport. */
export function loadSelectedDataset(sportId: SportId): string | undefined {
  try {
    return window.localStorage.getItem(selectionKey(sportId)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveSelectedDataset(sportId: SportId, leagueId: string): void {
  try {
    window.localStorage.setItem(selectionKey(sportId), leagueId);
  } catch {
    // Selection is a convenience; losing it is harmless.
  }
}
