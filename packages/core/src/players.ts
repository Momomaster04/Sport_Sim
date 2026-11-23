import type { Competitor, FixtureResult, Player } from './types';

/** A player's accumulated totals across a season. */
export interface PlayerTotals {
  playerId: string;
  competitorId: string;
  /** Summed stat keys, e.g. goals, assists, saves. */
  stats: Record<string, number>;
  /** Fixtures the player appeared in. */
  appearances: number;
}

/**
 * Add up every player line across a set of results.
 *
 * Engines report per-fixture lines; everything season-level — top scorers,
 * assist charts, clean sheets — is derived here so no engine has to carry
 * season bookkeeping of its own.
 */
export function playerTotals(results: readonly FixtureResult[]): PlayerTotals[] {
  const totals = new Map<string, PlayerTotals>();

  for (const result of results) {
    if (result.inProgress) continue;

    for (const line of result.players ?? []) {
      const existing = totals.get(line.playerId) ?? {
        playerId: line.playerId,
        competitorId: line.competitorId,
        stats: {},
        appearances: 0,
      };

      existing.appearances += 1;
      for (const [key, value] of Object.entries(line.stats)) {
        existing.stats[key] = (existing.stats[key] ?? 0) + value;
      }

      totals.set(line.playerId, existing);
    }
  }

  return [...totals.values()];
}

/**
 * The leading players for one stat, best first.
 *
 * Players on zero are dropped, so an early-season scoring chart shows only
 * those who have actually found the net.
 */
export function leaderboard(
  results: readonly FixtureResult[],
  key: string,
  limit = 10,
): PlayerTotals[] {
  return playerTotals(results)
    .filter((entry) => (entry.stats[key] ?? 0) > 0)
    .sort((a, b) => {
      const diff = (b.stats[key] ?? 0) - (a.stats[key] ?? 0);
      // Fewer appearances for the same tally is the better record.
      return diff !== 0 ? diff : a.appearances - b.appearances;
    })
    .slice(0, limit);
}

/** Index every player across a set of clubs, for looking names up by id. */
export function playerIndex(competitors: readonly Competitor[]): Map<string, Player> {
  const index = new Map<string, Player>();
  for (const competitor of competitors) {
    for (const player of competitor.squad ?? []) index.set(player.id, player);
  }
  return index;
}
