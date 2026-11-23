import type { StandingsRow } from './types';

/** A tie-break rule. Higher wins unless `ascending` is set. */
export interface SortKey {
  /** 'points', 'played', or any key present in a row's columns. */
  key: string;
  ascending?: boolean;
}

function valueOf(row: StandingsRow, key: string): number {
  if (key === 'points') return row.points;
  if (key === 'played') return row.played;
  return row.columns[key] ?? 0;
}

/**
 * Sort rows by the given keys in priority order and stamp each with its rank.
 * Ties that survive every key keep their incoming order, so a caller that
 * pre-sorts alphabetically gets a stable table across repeated renders.
 */
export function rankRows(rows: StandingsRow[], keys: readonly SortKey[]): StandingsRow[] {
  const sorted = [...rows].sort((left, right) => {
    for (const { key, ascending } of keys) {
      const diff = valueOf(right, key) - valueOf(left, key);
      if (diff !== 0) return ascending ? -diff : diff;
    }
    return 0;
  });

  return sorted.map((row, index) => ({ ...row, rank: index + 1 }));
}

/** Start an empty row for a competitor. */
export function emptyRow(competitorId: string, columns: readonly string[]): StandingsRow {
  return {
    competitorId,
    rank: 0,
    played: 0,
    points: 0,
    columns: Object.fromEntries(columns.map((key) => [key, 0])),
  };
}
