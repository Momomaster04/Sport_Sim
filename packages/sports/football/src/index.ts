import {
  emptyRow,
  rankRows,
  runToCompletion,
  type Competitor,
  type Fixture,
  type FixtureResult,
  type Rng,
  type SportDefinition,
  type StandingsRow,
} from '@sportsim/core';
import { FootballMatch } from './engine';
import { footballLeague } from './league';

const TABLE_COLUMNS = ['w', 'd', 'l', 'gf', 'ga', 'gd'] as const;

const POINTS_FOR_WIN = 3;
const POINTS_FOR_DRAW = 1;

/** Build the league table from every result played so far. */
function footballStandings(results: FixtureResult[], competitors: Competitor[]): StandingsRow[] {
  const rows = new Map<string, StandingsRow>(
    competitors.map((competitor) => [competitor.id, emptyRow(competitor.id, TABLE_COLUMNS)]),
  );

  for (const result of results) {
    if (result.inProgress) continue;
    const [home, away] = result.competitors;
    if (!home || !away) continue;

    const homeRow = rows.get(home.competitorId);
    const awayRow = rows.get(away.competitorId);
    if (!homeRow || !awayRow) continue;

    const homeGoals = home.score ?? 0;
    const awayGoals = away.score ?? 0;

    for (const [row, scored, conceded] of [
      [homeRow, homeGoals, awayGoals],
      [awayRow, awayGoals, homeGoals],
    ] as const) {
      row.played += 1;
      row.columns.gf = (row.columns.gf ?? 0) + scored;
      row.columns.ga = (row.columns.ga ?? 0) + conceded;
      row.columns.gd = (row.columns.gf ?? 0) - (row.columns.ga ?? 0);

      if (scored > conceded) {
        row.columns.w = (row.columns.w ?? 0) + 1;
        row.points += POINTS_FOR_WIN;
      } else if (scored === conceded) {
        row.columns.d = (row.columns.d ?? 0) + 1;
        row.points += POINTS_FOR_DRAW;
      } else {
        row.columns.l = (row.columns.l ?? 0) + 1;
      }
    }
  }

  return rankRows([...rows.values()], [{ key: 'points' }, { key: 'gd' }, { key: 'gf' }]);
}

export const football: SportDefinition = {
  id: 'football',
  name: 'Football',
  format: 'pair',
  clockUnit: 'min',
  scoreLabel: 'Goals',

  ratingKeys: [
    { key: 'attack', label: 'Attack', title: 'Drives chance quality and how often the side threatens' },
    { key: 'midfield', label: 'Midfield', title: 'Drives possession share' },
    { key: 'defence', label: 'Defence', title: 'Suppresses the quality of chances faced' },
  ],

  standingsColumns: [
    { key: 'w', label: 'W', title: 'Won' },
    { key: 'd', label: 'D', title: 'Drawn' },
    { key: 'l', label: 'L', title: 'Lost' },
    { key: 'gf', label: 'GF', title: 'Goals for' },
    { key: 'ga', label: 'GA', title: 'Goals against' },
    { key: 'gd', label: 'GD', title: 'Goal difference' },
  ],

  boxScoreColumns: [
    { key: 'possession', label: 'Poss %' },
    { key: 'shots', label: 'Shots' },
    { key: 'sot', label: 'On target' },
    { key: 'xg', label: 'xG' },
    { key: 'corners', label: 'Corners' },
    { key: 'fouls', label: 'Fouls' },
    { key: 'yellow', label: 'Yellow' },
    { key: 'red', label: 'Red' },
  ],

  simulate(fixture: Fixture, competitors: Competitor[], rng: Rng): FixtureResult {
    return runToCompletion(new FootballMatch(fixture, competitors, rng));
  },

  createLive(fixture: Fixture, competitors: Competitor[], rng: Rng) {
    return new FootballMatch(fixture, competitors, rng);
  },

  standings: footballStandings,
  defaultLeague: footballLeague,
};

export { FootballMatch } from './engine';
export { footballCompetitors, footballLeague } from './league';
