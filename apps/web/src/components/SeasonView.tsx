import {
  fixturesForRound,
  isComplete,
  leaderboard,
  playRound,
  playerIndex,
  recordResult,
  resultFor,
  simulateFixture,
  standings,
  totalRounds,
  type Competitor,
  type Fixture,
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

/** Simulate a specific set of fixtures and fold the results into the season. */
function simulateFixtures(sport: SportDefinition, season: Season, fixtures: readonly Fixture[]): Season {
  return fixtures.reduce(
    (current, fixture) => recordResult(current, simulateFixture(sport, current, fixture)),
    season,
  );
}

export function SeasonView({ sport, season, onChange, onReset }: Props) {
  const rounds = totalRounds(season);
  const complete = isComplete(season);
  const [viewRound, setViewRound] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byId = useMemo(
    () => new Map(season.competitors.map((competitor) => [competitor.id, competitor])),
    [season.competitors],
  );
  const table = useMemo(() => standings(sport, season), [sport, season]);
  const squads = useMemo(() => playerIndex(season.competitors), [season.competitors]);
  const scorers = useMemo(() => leaderboard(season.results, 'goals', 8), [season.results]);

  const team = (id: string): Competitor =>
    byId.get(id) ?? { id, name: id, short: id.slice(0, 3).toUpperCase(), ratings: {} };

  const scored = season.results.reduce(
    (sum, result) => sum + result.competitors.reduce((inner, side) => inner + (side.score ?? 0), 0),
    0,
  );
  const leader = table[0];

  const shownRound = Math.min(Math.max(viewRound, 1), rounds);
  const roundFixtures = fixturesForRound(season, shownRound);
  const unplayed = roundFixtures.filter((fixture) => !resultFor(season, fixture.id));
  const selectedFixtures = unplayed.filter((fixture) => selected.has(fixture.id));

  function toggle(fixtureId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(fixtureId)) next.delete(fixtureId);
      else next.add(fixtureId);
      return next;
    });
  }

  function runFixtures(fixtures: readonly Fixture[]) {
    if (fixtures.length === 0) return;
    onChange(simulateFixtures(sport, season, fixtures));
    setSelected(new Set());
  }

  function goToRound(round: number) {
    setViewRound(round);
    setSelected(new Set());
  }

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

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title={`${season.leagueName}${season.leagueSeason ? ` ${season.leagueSeason}` : ''}`}
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

          <Card>
            <CardHeader title="Top scorers" subtitle={scorers.length ? 'Goals, then assists' : undefined} />
            {scorers.length === 0 ? (
              <EmptyState title="No goals yet" body="Simulate some fixtures and the scoring chart will fill in." />
            ) : (
              <ol className="divide-y divide-pitch-800/60">
                {scorers.map((scorer, index) => {
                  const player = squads.get(scorer.playerId);
                  const club = team(scorer.competitorId);
                  return (
                    <li key={scorer.playerId} className="flex items-center gap-3 px-5 py-2 text-sm">
                      <span className="nums w-4 text-xs text-emerald-100/35">{index + 1}</span>
                      <TeamDot color={club.color} />
                      <span className="min-w-0 flex-1 truncate text-emerald-50">
                        {player?.name ?? scorer.playerId}
                        <span className="ml-2 text-xs text-emerald-100/40">{club.short}</span>
                      </span>
                      <span className="nums text-xs text-emerald-100/45">{scorer.stats.assists ?? 0} ast</span>
                      <span className="nums w-7 text-right font-semibold text-white">{scorer.stats.goals ?? 0}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <Card className="self-start">
          <CardHeader
            title={`Round ${shownRound}`}
            subtitle={unplayed.length ? `${unplayed.length} still to play` : 'All played'}
            action={
              <span className="flex gap-1.5">
                <Button
                  className="px-2.5 py-1"
                  disabled={shownRound <= 1}
                  onClick={() => goToRound(shownRound - 1)}
                  aria-label="Previous round"
                >
                  ‹
                </Button>
                <Button
                  className="px-2.5 py-1"
                  disabled={shownRound >= rounds}
                  onClick={() => goToRound(shownRound + 1)}
                  aria-label="Next round"
                >
                  ›
                </Button>
              </span>
            }
          />

          {unplayed.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-pitch-700/50 px-5 py-3">
              <Button
                variant="primary"
                className="px-2.5 py-1 text-xs"
                disabled={selectedFixtures.length === 0}
                onClick={() => runFixtures(selectedFixtures)}
              >
                Sim selected ({selectedFixtures.length})
              </Button>
              <Button
                className="px-2.5 py-1 text-xs"
                onClick={() => setSelected(new Set(unplayed.map((fixture) => fixture.id)))}
              >
                Select all
              </Button>
              {selected.size > 0 ? (
                <Button className="px-2.5 py-1 text-xs" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}

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
                const isSelected = selected.has(fixture.id);

                return (
                  <li key={fixture.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    {result ? (
                      <span className="w-4 shrink-0" />
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(fixture.id)}
                        aria-label={`Select ${home.name} versus ${away.name}`}
                        className="size-3.5 shrink-0 accent-[var(--color-accent)]"
                      />
                    )}

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

                    {result ? (
                      <span className="w-10 shrink-0" />
                    ) : (
                      <Button
                        className="w-10 shrink-0 px-1.5 py-0.5 text-[11px]"
                        onClick={() => runFixtures([fixture])}
                      >
                        Sim
                      </Button>
                    )}
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
