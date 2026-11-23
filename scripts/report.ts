/**
 * Print a simulated season to the terminal.
 *
 * This is the quickest way to sanity check an engine by eye: run it, and see
 * whether the table, the scorelines and the spread of points look like the
 * sport they are meant to be modelling.
 *
 *   npm run report -- --seed=2026 --sport=soccer
 */
import { createSeason, playSeason, standings, totalRounds, type SportDefinition } from '@sportsim/core';
import { soccer } from '@sportsim/soccer';

const SPORTS: Record<string, SportDefinition> = { soccer };

function arg(name: string, fallback: string): string {
  const match = process.argv.find((value) => value.startsWith(`--${name}=`));
  return match ? match.slice(name.length + 3) : fallback;
}

function pad(value: string | number, width: number, left = false): string {
  const text = String(value);
  return left ? text.padEnd(width) : text.padStart(width);
}

const sportId = arg('sport', 'soccer');
const sport = SPORTS[sportId];
if (!sport) {
  console.error(`Unknown sport "${sportId}". Available: ${Object.keys(SPORTS).join(', ')}`);
  process.exit(1);
}

const seed = arg('seed', 'demo');
const started = Date.now();
const season = playSeason(sport, createSeason(sport, { seed }));
const elapsed = Date.now() - started;

const nameOf = (id: string) => season.competitors.find((team) => team.id === id)?.name ?? id;

console.log(`\n${season.leagueName} — ${sport.name}`);
console.log(`seed "${seed}" · ${totalRounds(season)} rounds · ${season.results.length} fixtures · simulated in ${elapsed}ms\n`);

const header = [pad('#', 2), pad('Club', 20, true), 'Pl', ...sport.standingsColumns.map((column) => pad(column.label, 4)), pad('Pts', 4)];
console.log(header.join(' '));
console.log('-'.repeat(header.join(' ').length));

for (const row of standings(sport, season)) {
  console.log(
    [
      pad(row.rank, 2),
      pad(nameOf(row.competitorId), 20, true),
      pad(row.played, 2),
      ...sport.standingsColumns.map((column) => pad(row.columns[column.key] ?? 0, 4)),
      pad(row.points, 4),
    ].join(' '),
  );
}

const goals = season.results.reduce(
  (sum, result) => sum + result.competitors.reduce((inner, side) => inner + (side.score ?? 0), 0),
  0,
);
console.log(`\nAverage ${sport.scoreLabel.toLowerCase()} per fixture: ${(goals / season.results.length).toFixed(2)}`);

const biggest = [...season.results].sort((a, b) => {
  const margin = (result: typeof a) => Math.abs((result.competitors[0]?.score ?? 0) - (result.competitors[1]?.score ?? 0));
  return margin(b) - margin(a);
})[0];

if (biggest) {
  const [home, away] = biggest.competitors;
  console.log(
    `Biggest win: ${nameOf(home?.competitorId ?? '')} ${home?.score} - ${away?.score} ${nameOf(away?.competitorId ?? '')} (round ${biggest.round})\n`,
  );
}
