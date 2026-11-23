import type { Competitor, LeagueTemplate } from '@sportsim/core';

/**
 * A fictional twenty-club league.
 *
 * These are invented clubs rather than real ones, which keeps the project
 * publishable and means the ratings are ours to tune. Swapping in a real
 * division is purely a data change: replace this array and nothing else.
 */
const CLUBS: Array<[name: string, short: string, attack: number, midfield: number, defence: number, color: string]> = [
  ['Ashford United', 'ASH', 88, 86, 84, '#c8102e'],
  ['Kingsmead City', 'KIN', 86, 88, 85, '#6cabdd'],
  ['Westmere United', 'WES', 85, 84, 83, '#da291c'],
  ['Stonehurst Rovers', 'STO', 83, 85, 86, '#132257'],
  ['Larkfield Albion', 'LRK', 82, 81, 80, '#003399'],
  ['Calderwood Rovers', 'CAL', 80, 79, 81, '#c8102e'],
  ['Harrowgate FC', 'HAR', 78, 80, 78, '#0057b8'],
  ['Eastvale FC', 'EAS', 77, 76, 79, '#7a263a'],
  ['Thornbury FC', 'THO', 76, 75, 74, '#1b458f'],
  ['Northcliffe Town', 'NOR', 75, 74, 76, '#241f20'],
  ['Ironbridge United', 'IRN', 74, 73, 73, '#fdb913'],
  ['Pellford City', 'PEL', 73, 72, 75, '#60223b'],
  ['Marshwood FC', 'MAR', 72, 73, 71, '#ee2737'],
  ['Glenmoor Rangers', 'GLN', 71, 70, 72, '#00a650'],
  ['Oakhaven United', 'OAK', 70, 71, 70, '#e03a3e'],
  ['Dunmore Athletic', 'DUN', 69, 68, 70, '#1d428a'],
  ['Redbourne Athletic', 'RED', 68, 69, 67, '#d71920'],
  ['Fenwick Town', 'FEN', 66, 67, 68, '#5d2e8c'],
  ['Brackenby City', 'BRC', 65, 64, 66, '#f78f1e'],
  ['Quarrydale FC', 'QUA', 63, 65, 64, '#00573f'],
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function footballCompetitors(): Competitor[] {
  return CLUBS.map(([name, short, attack, midfield, defence, color]) => ({
    id: slug(name),
    name,
    short,
    color,
    ratings: { attack, midfield, defence },
  }));
}

export function footballLeague(): LeagueTemplate {
  return {
    id: 'premier-division',
    name: 'Premier Division',
    competitors: footballCompetitors(),
    doubleRoundRobin: true,
  };
}
