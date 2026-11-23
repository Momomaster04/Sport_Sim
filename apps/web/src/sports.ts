import type { SportDefinition, SportId } from '@sportsim/core';
import { football } from '@sportsim/football';

export interface SportEntry {
  id: SportId;
  label: string;
  /** Short tagline shown under the sport name when it is not yet playable. */
  note: string;
  definition?: SportDefinition;
}

/**
 * Every sport the app knows about, playable or not.
 *
 * Entries without a `definition` render as disabled tabs. Shipping a new sport
 * is a one-line change here plus the engine package itself.
 */
export const SPORTS: SportEntry[] = [
  { id: 'football', label: 'Football', note: '20-club league season', definition: football },
  { id: 'nba', label: 'Basketball', note: 'In development' },
  { id: 'american-football', label: 'American Football', note: 'In development' },
  { id: 'f1', label: 'Formula 1', note: 'In development' },
];

export function sportEntry(id: SportId): SportEntry {
  const entry = SPORTS.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown sport ${id}`);
  return entry;
}

/** The sports that can actually be played right now. */
export function playableSports(): Array<SportEntry & { definition: SportDefinition }> {
  return SPORTS.filter(
    (entry): entry is SportEntry & { definition: SportDefinition } => entry.definition !== undefined,
  );
}
