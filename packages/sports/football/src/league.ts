import type { Competitor, LeagueTemplate } from '@sportsim/core';
import { withSquads } from './squad';

/**
 * Premier League clubs for the 2025/26 season.
 *
 * Club names are used factually to identify real teams; no badges, kits or
 * other club artwork are included anywhere in this project. Ratings are my own
 * estimates of relative strength, not official data, and are meant to be
 * edited. The whole league is plain data so a different season can be loaded,
 * imported or typed in without touching the engine.
 *
 * Columns: name, abbreviation, attack, midfield, defence, primary colour.
 */
const CLUBS_2025_26: Array<[string, string, number, number, number, string]> = [
  ['Liverpool', 'LIV', 88, 87, 85, '#c8102e'],
  ['Arsenal', 'ARS', 85, 87, 88, '#ef0107'],
  ['Manchester City', 'MCI', 88, 88, 84, '#6cabdd'],
  ['Chelsea', 'CHE', 83, 84, 81, '#034694'],
  ['Newcastle United', 'NEW', 82, 81, 82, '#241f20'],
  ['Aston Villa', 'AVL', 81, 81, 80, '#670e36'],
  ['Tottenham Hotspur', 'TOT', 81, 79, 75, '#132257'],
  ['Manchester United', 'MUN', 79, 78, 76, '#da291c'],
  ['Brighton & Hove Albion', 'BHA', 78, 79, 76, '#0057b8'],
  ['Nottingham Forest', 'NFO', 77, 75, 79, '#dd0000'],
  ['Crystal Palace', 'CRY', 76, 76, 78, '#1b458f'],
  ['AFC Bournemouth', 'BOU', 76, 76, 77, '#da291c'],
  ['Brentford', 'BRE', 76, 74, 73, '#e30613'],
  ['Fulham', 'FUL', 75, 76, 75, '#1b1b1b'],
  ['West Ham United', 'WHU', 73, 72, 71, '#7a263a'],
  ['Everton', 'EVE', 72, 73, 76, '#003399'],
  ['Wolverhampton Wanderers', 'WOL', 71, 70, 69, '#fdb913'],
  ['Leeds United', 'LEE', 70, 71, 69, '#1d428a'],
  ['Sunderland', 'SUN', 69, 70, 69, '#eb172b'],
  ['Burnley', 'BUR', 67, 68, 72, '#6c1d45'],
];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** The clubs on their own, without squads attached. */
export function footballCompetitors(): Competitor[] {
  return CLUBS_2025_26.map(([name, short, attack, midfield, defence, color]) => ({
    id: slug(name),
    name,
    short,
    color,
    ratings: { attack, midfield, defence },
  }));
}

/** The bundled Premier League dataset, with generated squads attached. */
export function footballLeague(): LeagueTemplate {
  return {
    id: 'premier-league-2025-26',
    name: 'Premier League',
    season: '2025/26',
    sportId: 'football',
    competitors: withSquads(footballCompetitors(), 'pl-2025-26'),
    doubleRoundRobin: true,
  };
}

/**
 * Every dataset shipped with the app.
 *
 * Historical seasons can be added here as they are built, or loaded at runtime
 * from an imported file. Keeping them in a list rather than a single default
 * is what lets the app offer a season picker.
 */
export function bundledLeagues(): LeagueTemplate[] {
  return [footballLeague()];
}
