import { Rng, type Competitor, type Player, type PlayerPosition } from '@sportsim/core';

/**
 * Name pools used to build squads.
 *
 * Deliberately generic and drawn from the range of nationalities a league
 * tends to field. Combinations are random, so any resemblance to a particular
 * professional is coincidence rather than an attempt to model them.
 */
const FIRST_NAMES = [
  'Adam', 'Alex', 'Andre', 'Antoine', 'Bruno', 'Callum', 'Carlos', 'Daniel', 'Diego', 'Dominic',
  'Eduardo', 'Elias', 'Emre', 'Felix', 'Finn', 'Gabriel', 'Hugo', 'Ibrahim', 'Isaac', 'Jack',
  'Jamal', 'Jonas', 'Jordan', 'Kai', 'Karim', 'Kevin', 'Leo', 'Lucas', 'Luka', 'Marco',
  'Mateo', 'Mathias', 'Mohammed', 'Nathan', 'Nico', 'Oliver', 'Omar', 'Oscar', 'Pablo', 'Pedro',
  'Rafael', 'Reece', 'Ryan', 'Samuel', 'Sebastian', 'Sofiane', 'Thomas', 'Tobias', 'Victor', 'Yusuf',
];

const LAST_NAMES = [
  'Almeida', 'Andersen', 'Bakker', 'Bennett', 'Bianchi', 'Brandt', 'Carter', 'Castro', 'Chevalier', 'Costa',
  'Delgado', 'Dimitrov', 'Doyle', 'Duarte', 'Ferreira', 'Fischer', 'Gallagher', 'Garcia', 'Haugen', 'Hayes',
  'Horvat', 'Ibrahim', 'Jansen', 'Keller', 'Kovac', 'Laurent', 'Lindqvist', 'Marchetti', 'Mendes', 'Moreau',
  'Navarro', 'Nowak', 'Okafor', 'Pereira', 'Petrov', 'Ramos', 'Reid', 'Ricci', 'Rossi', 'Sanchez',
  'Schneider', 'Silva', 'Sorensen', 'Traore', 'Vargas', 'Vermeulen', 'Walsh', 'Weber', 'Wright', 'Zieliński',
];

/** Squad shape: how many of each position, and their shirt number range. */
const SQUAD_PLAN: Array<{ position: PlayerPosition; count: number }> = [
  { position: 'GK', count: 3 },
  { position: 'DF', count: 8 },
  { position: 'MF', count: 7 },
  { position: 'FW', count: 5 },
];

/**
 * How much each position leans on each rating.
 *
 * A centre forward is built around finishing, a defender around defending, and
 * so on. The engine reads these same keys back when it picks who scores.
 */
const POSITION_WEIGHTS: Record<PlayerPosition, Record<string, number>> = {
  GK: { keeping: 1, defending: 0.45, physical: 0.6, creativity: 0.25, attack: 0.1 },
  DF: { keeping: 0.05, defending: 1, physical: 0.85, creativity: 0.45, attack: 0.25 },
  MF: { keeping: 0.05, defending: 0.6, physical: 0.65, creativity: 1, attack: 0.6 },
  FW: { keeping: 0.05, defending: 0.25, physical: 0.7, creativity: 0.7, attack: 1 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

/**
 * Build a full squad for a club.
 *
 * Seeded from the club id, so a club always gets the same squad and a saved
 * season stays consistent with a freshly generated one. Players within a
 * position are graded from first choice down to squad filler, which gives the
 * engine a meaningful starting eleven to pick.
 */
export function generateSquad(club: Competitor, seed = 'squad'): Player[] {
  const rng = new Rng(`${seed}:${club.id}`);
  const strength = (club.ratings.attack ?? 70) * 0.35 + (club.ratings.midfield ?? 70) * 0.33 + (club.ratings.defence ?? 70) * 0.32;

  const players: Player[] = [];
  let shirt = 1;

  for (const { position, count } of SQUAD_PLAN) {
    for (let depth = 0; depth < count; depth += 1) {
      // First choice players sit near club strength; squad players fall away.
      const depthPenalty = depth * (position === 'GK' ? 7 : 3.2);
      const base = strength - depthPenalty + rng.normal(0, 3);
      const weights = POSITION_WEIGHTS[position];

      const ratings: Record<string, number> = {};
      for (const [key, weight] of Object.entries(weights)) {
        // Off-position ratings drift toward the middle rather than scaling flat.
        const target = 50 + (base - 50) * weight;
        ratings[key] = clamp(target + rng.normal(0, 2.5), 35, 99);
      }

      players.push({
        id: `${club.id}-p${shirt}`,
        name: `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`,
        position,
        number: shirt,
        age: rng.int(18, 35),
        ratings,
      });
      shirt += 1;
    }
  }

  return players;
}

/** Attach a generated squad to any club that does not already have one. */
export function withSquads(clubs: Competitor[], seed = 'squad'): Competitor[] {
  return clubs.map((club) => (club.squad?.length ? club : { ...club, squad: generateSquad(club, seed) }));
}

/** The strongest available players for a position, best first. */
export function bestAt(squad: readonly Player[], position: PlayerPosition, count: number): Player[] {
  const key = position === 'GK' ? 'keeping' : position === 'DF' ? 'defending' : position === 'MF' ? 'creativity' : 'attack';
  return [...squad]
    .filter((player) => player.position === position)
    .sort((a, b) => (b.ratings[key] ?? 0) - (a.ratings[key] ?? 0))
    .slice(0, count);
}

/** A starting eleven in a 4-3-3, best available at each position. */
export function startingEleven(squad: readonly Player[]): Player[] {
  if (squad.length === 0) return [];
  return [...bestAt(squad, 'GK', 1), ...bestAt(squad, 'DF', 4), ...bestAt(squad, 'MF', 3), ...bestAt(squad, 'FW', 3)];
}

function meanRating(players: readonly Player[], key: string): number {
  if (players.length === 0) return 70;
  return players.reduce((sum, player) => sum + (player.ratings[key] ?? 70), 0) / players.length;
}

/**
 * Derive a club's effective ratings from the eleven it fields.
 *
 * This is what gives the sim its depth: strength comes from the players a club
 * can actually put out, so swapping one striker for a better one moves the
 * club's attack rating and everything downstream of it.
 */
export function effectiveRatings(club: Competitor): Record<string, number> {
  const squad = club.squad ?? [];
  if (squad.length === 0) return club.ratings;

  const eleven = startingEleven(squad);
  const forwards = eleven.filter((player) => player.position === 'FW');
  const midfield = eleven.filter((player) => player.position === 'MF');
  const defence = eleven.filter((player) => player.position === 'DF');
  const keeper = eleven.filter((player) => player.position === 'GK');

  return {
    attack: meanRating(forwards, 'attack') * 0.7 + meanRating(midfield, 'attack') * 0.3,
    midfield: meanRating(midfield, 'creativity') * 0.7 + meanRating(forwards, 'creativity') * 0.15 + meanRating(defence, 'creativity') * 0.15,
    defence: meanRating(defence, 'defending') * 0.65 + meanRating(midfield, 'defending') * 0.2 + meanRating(keeper, 'keeping') * 0.15,
    keeping: meanRating(keeper, 'keeping'),
  };
}
