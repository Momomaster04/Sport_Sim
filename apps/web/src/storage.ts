import type { Season, SportId } from '@sportsim/core';

// Bumped whenever the bundled datasets change shape, so a saved season from an
// older club list is discarded rather than restored against clubs that no
// longer exist.
const VERSION = 2;
const KEY_PREFIX = 'sportsim';

interface Envelope {
  version: number;
  season: Season;
}

function keyFor(sportId: SportId): string {
  return `${KEY_PREFIX}:${VERSION}:season:${sportId}`;
}

/**
 * Read a saved season.
 *
 * Every access is guarded: storage can be unavailable in a private window, and
 * a saved payload can predate a schema change. Either way the app should fall
 * back to a fresh season rather than fail to load.
 */
export function loadSeason(sportId: SportId): Season | undefined {
  try {
    const raw = window.localStorage.getItem(keyFor(sportId));
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as Envelope;
    if (parsed.version !== VERSION || parsed.season?.sportId !== sportId) return undefined;
    if (!Array.isArray(parsed.season.fixtures) || !Array.isArray(parsed.season.results)) return undefined;

    return parsed.season;
  } catch {
    return undefined;
  }
}

export function saveSeason(season: Season): void {
  try {
    const envelope: Envelope = { version: VERSION, season };
    window.localStorage.setItem(keyFor(season.sportId), JSON.stringify(envelope));
  } catch {
    // A full or unavailable store should never interrupt a simulation.
  }
}

export function clearSeason(sportId: SportId): void {
  try {
    window.localStorage.removeItem(keyFor(sportId));
  } catch {
    // Nothing to do if storage is unavailable.
  }
}
