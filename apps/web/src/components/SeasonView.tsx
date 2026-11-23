import {
  fixturesForRound,
  isComplete,
  playRound,
  resultFor,
  standings,
  totalRounds,
  type Competitor,
  type Season,
  type SportDefinition,
} from '@sportsim/core';
import { useMemo, useState } from 'react';
import { Button, Card, CardHeader, EmptyState, Stat, TeamDot } from './ui';

interface Props {
  sport: SportDefinition;
  season: Season;
  onChange: (season: Season) => void;
  onReset: () => void;
}

/** Play up to `count` rounds, or to the end of the season if sooner. */
function advance(sport: SportDefinition, season: Season, count: number): Season {
  let next = season;
  for (let i = 0; i < count && !isComplete(next); i += 1) {
    next = playRound(sport, next);
  }
  return next;
}

export function SeasonView({ sport, season, onChange, onReset }: Props) {
  const rounds = totalRounds(season);
  const complete = isComplete(season);
  const [viewRound, setViewRound] = useState(1);

  const byId = useMemo(
    () => new Map(season.competitors.map((competitor) => [competitor.id, competitor])),
    [season.competitors],
  );
  const table = useMemo(() => standings(sport, season), [sport, season]);

  const team = (id: string): Competitor =>
    byId.get(id) ?? { id, name: id, short: id.slice(0, 3).toUpperCase(), ratings: {} };

  const scored = season.results.reduce(
    (sum, result) => sum + result.competitors.reduce((inner, side) => inner + (side.score ?? 0), 0),
    0,
  );
  const leader = table[0];

  // Follow the simulation forward, but leave the user wherever they navigated.
  const shownRound = Math.min(Math.max(viewRound, 1), rounds);
  const roundFixtures = fixturesForRound(season, shownRound);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Round"
          value={complete ? `${rounds} / ${rounds}` : `${Math.min(season.nextRound, rounds)} / ${rounds}`}
        />
        <Stat label="Fixtures played" value={`${season.results.length} / ${season.fixtures.length}`} />
        <Stat
          label={`${sport.scoreLabel} per game`}
          value={season.results.length ? (scored / season.results.length).toFixed(2) : '—'}
        />
        <Stat label={complete ? 'Champion' : 'Leader'} value={leader ? team(leader.competitorId).short : '—'} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={complete} onClick={() => onChange(advance(sport, season, 1))}>
          Play next round
        </Button>
        <Button disabled={complete} onClick={() => onChange(advance(sport, season, 5))}>
          Play 5 rounds
        </Button>
        <Button disabled={complete} onClick={() => onChange(advance(sport, season, rounds))}>
          Play whole season
        </Button>
        <span className="ml-auto flex items-center gap-3">
          <code className="rounded bg-pitch-800/60 px-2 py-1 text-xs text-emerald-100/50">seed {season.seed}</code>
          <Button variant="danger" onClick={onReset}>
            New season
          </Button>
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title={season.leagueName}
            subtitle={complete ? 'Final table' : `After ${season.results.length} fixtures`}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider text-emerald-100/40 uppercase">
                  <th className="py-2 pl-5 text-left font-medium">#</th>
                  <th className="py-2 text-left font-medium">Team</th>
                  <th className="px-2 py-2 text-right font-medium">Pl</th>
                  {sport.standingsColumns.map((column) => (
                    <th key={column.key} className="px-2 py-2 text-right font-medium" title={column.title}>
                      {column.label}
                    </th>
                  ))}
                  <th className="py-2 pr-5 pl-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row) => {
                  const competitor = team(row.competitorId);
                  return (
                    <tr
                      key={row.competitorId}
                      className="border-t border-pitch-800/70 transition-colors hover:bg-pitch-800/40"
                    >
                      <td className="nums py-2 pl-5 text-emerald-100/40">{row.rank}</td>
                      <td className="py-2">
                        <span className="flex items-center gap-2">
                          <TeamDot color={competitor.color} />
                          <span className="truncate text-emerald-50">{competitor.name}</span>
                        </span>
                      </td>
                      <td className="nums px-2 py-2 text-right text-emerald-100/60">{row.played}</td>
                      {sport.standingsColumns.map((column) => (
                        <td key={column.key} className="nums px-2 py-2 text-right text-emerald-100/70">
                          {row.columns[column.key] ?? 0}
                        </td>
                      ))}
                      <td className="nums py-2 pr-5 pl-2 text-right font-semibold text-white">{row.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader
            title={`Round ${shownRound}`}
            action={
              <span className="flex gap-1.5">
                <Button
                  className="px-2.5 py-1"
                  disabled={shownRound <= 1}
                  onClick={() => setViewRound(shownRound - 1)}
                  aria-label="Previous round"
                >
                  ‹
                </Button>
                <Button
                  className="px-2.5 py-1"
                  disabled={shownRound >= rounds}
                  onClick={() => setViewRound(shownRound + 1)}
                  aria-label="Next round"
                >
                  ›
                </Button>
              </span>
            }
          />

          {roundFixtures.length === 0 ? (
            <EmptyState title="No fixtures" body="This round has no scheduled fixtures." />
          ) : (
            <ul className="divide-y divide-pitch-800/70">
              {roundFixtures.map((fixture) => {
                const result = resultFor(season, fixture.id);
                const [homeId, awayId] = fixture.competitorIds as [string, string];
                const home = team(homeId);
                const away = team(awayId);
                const homeScore = result?.competitors.find((side) => side.competitorId === homeId)?.score;
                const awayScore = result?.competitors.find((side) => side.competitorId === awayId)?.score;

                return (
                  <li key={fixture.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
                    <span className="flex flex-1 items-center justify-end gap-2 truncate">
                      <span className="truncate text-emerald-50">{home.name}</span>
                      <TeamDot color={home.color} />
                    </span>
                    <span
                      className={`nums rounded px-2 py-0.5 text-xs font-semibold ${
                        result ? 'bg-pitch-700/70 text-white' : 'bg-pitch-800/60 text-emerald-100/35'
                      }`}
                    >
                      {result ? `${homeScore} – ${awayScore}` : 'vs'}
                    </span>
                    <span className="flex flex-1 items-center gap-2 truncate">
                      <TeamDot color={away.color} />
                      <span className="truncate text-emerald-50">{away.name}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
