import { Rng } from './rng';
import type { Fixture, LeagueTemplate } from './types';

const BYE = '__bye__';

/**
 * Build a round-robin schedule using the circle method.
 *
 * Home and away sides alternate by round so no team ends up with a wildly
 * lopsided home split. With an odd number of competitors one sits out each
 * round. When `double` is set, the whole thing is replayed with the venues
 * reversed, which is how most domestic leagues work.
 */
export function roundRobin(competitorIds: readonly string[], double: boolean): Fixture[] {
  if (competitorIds.length < 2) return [];

  const wheel = [...competitorIds];
  if (wheel.length % 2 === 1) wheel.push(BYE);

  const size = wheel.length;
  const half = size / 2;
  const legOne: Array<[string, string]>[] = [];

  for (let round = 0; round < size - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < half; i += 1) {
      const a = wheel[i] as string;
      const b = wheel[size - 1 - i] as string;
      if (a === BYE || b === BYE) continue;
      pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
    }
    legOne.push(pairs);

    // Rotate every entry except the first.
    const rest = wheel.slice(1);
    rest.unshift(rest.pop() as string);
    wheel.splice(1, wheel.length - 1, ...rest);
  }

  const legs = double
    ? [...legOne, ...legOne.map((pairs) => pairs.map(([home, away]) => [away, home] as [string, string]))]
    : legOne;

  return legs.flatMap((pairs, index) =>
    pairs.map((pair, slot) => ({
      id: `r${index + 1}-m${slot + 1}`,
      round: index + 1,
      competitorIds: pair,
    })),
  );
}

/**
 * Build a calendar for a field sport, where every competitor takes part in
 * every round. The entry order is shuffled per round so the engine starts from
 * a neutral list rather than the order the competitors were defined in.
 */
export function fieldSchedule(
  competitorIds: readonly string[],
  rounds: number,
  seed: string,
): Fixture[] {
  if (competitorIds.length < 2 || rounds < 1) return [];

  return Array.from({ length: rounds }, (_, index) => {
    const rng = new Rng(`${seed}:entry:${index + 1}`);
    return {
      id: `r${index + 1}`,
      round: index + 1,
      competitorIds: rng.shuffle(competitorIds),
    };
  });
}

/** Pick the right scheduler for a league template. */
export function buildSchedule(
  league: LeagueTemplate,
  format: 'pair' | 'field',
  seed: string,
): Fixture[] {
  const ids = league.competitors.map((competitor) => competitor.id);
  return format === 'pair'
    ? roundRobin(ids, league.doubleRoundRobin)
    : fieldSchedule(ids, league.rounds ?? 1, seed);
}
