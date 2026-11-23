import { Rng, type Competitor, type Fixture, type SportDefinition } from '@sportsim/core';
import { useEffect, useMemo, useState } from 'react';
import { Button, Card, CardHeader, Stat, TeamDot } from './ui';

interface Props {
  sport: SportDefinition;
  competitors: Competitor[];
}

const RUN_SIZES = [500, 2_000, 10_000] as const;

interface Outcome {
  runs: number;
  homeWins: number;
  draws: number;
  awayWins: number;
  homeScore: number;
  awayScore: number;
  /** Scorelines keyed "2-1", with how often each came up. */
  scorelines: Map<string, number>;
}

function percent(part: number, whole: number): string {
  return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

/**
 * Run the same matchup many times over and tally the outcomes.
 *
 * Each run gets its own seed, so this samples the engine's distribution rather
 * than replaying one match. That makes it the quickest way to see what a
 * rating change actually does to a team's chances.
 */
function runBatch(sport: SportDefinition, home: Competitor, away: Competitor, runs: number): Outcome {
  const fixture: Fixture = { id: 'sandbox', round: 1, competitorIds: [home.id, away.id] };
  const outcome: Outcome = {
    runs,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    homeScore: 0,
    awayScore: 0,
    scorelines: new Map(),
  };

  for (let i = 0; i < runs; i += 1) {
    const result = sport.simulate(fixture, [home, away], new Rng(`sandbox-${i}`));
    const [homeSide, awaySide] = result.competitors;
    const homeGoals = homeSide?.score ?? 0;
    const awayGoals = awaySide?.score ?? 0;

    outcome.homeScore += homeGoals;
    outcome.awayScore += awayGoals;
    if (homeGoals > awayGoals) outcome.homeWins += 1;
    else if (homeGoals < awayGoals) outcome.awayWins += 1;
    else outcome.draws += 1;

    const key = `${homeGoals}-${awayGoals}`;
    outcome.scorelines.set(key, (outcome.scorelines.get(key) ?? 0) + 1);
  }

  return outcome;
}

export function SandboxView({ sport, competitors }: Props) {
  const [homeId, setHomeId] = useState(competitors[0]?.id ?? '');
  const [awayId, setAwayId] = useState(competitors[1]?.id ?? '');
  const [runs, setRuns] = useState<number>(RUN_SIZES[1]);
  const [ratings, setRatings] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const base = useMemo(() => new Map(competitors.map((team) => [team.id, team])), [competitors]);

  /** A competitor with any sandbox rating overrides applied. */
  const withOverrides = (id: string): Competitor | undefined => {
    const team = base.get(id);
    if (!team) return undefined;
    return { ...team, ratings: { ...team.ratings, ...(ratings[id] ?? {}) } };
  };

  const home = withOverrides(homeId);
  const away = withOverrides(awayId);
  const sameTeam = homeId === awayId;

  // Any change to the matchup or the ratings invalidates the last batch.
  useEffect(() => setOutcome(null), [homeId, awayId, ratings, runs]);

  function run() {
    if (!home || !away || sameTeam) return;
    setBusy(true);
    // Defer so the button can paint its busy state before the loop blocks.
    window.setTimeout(() => {
      setOutcome(runBatch(sport, home, away, runs));
      setBusy(false);
    }, 0);
  }

  function setRating(id: string, key: string, value: number) {
    setRatings((current) => ({ ...current, [id]: { ...(current[id] ?? {}), [key]: value } }));
  }

  const topScorelines = outcome
    ? [...outcome.scorelines.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    : [];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {[
          { side: 'Home', id: homeId, setId: setHomeId, team: home },
          { side: 'Away', id: awayId, setId: setAwayId, team: away },
        ].map(({ side, id, setId, team }) => (
          <Card key={side}>
            <CardHeader title={side} subtitle="Drag a rating to see how the odds move" />
            <div className="space-y-4 px-5 py-4">
              <select
                value={id}
                onChange={(event) => setId(event.target.value)}
                className="w-full rounded-lg border border-pitch-700/70 bg-pitch-800 px-3 py-2 text-sm text-emerald-50 focus-visible:outline-2 focus-visible:outline-accent"
              >
                {competitors.map((competitor) => (
                  <option key={competitor.id} value={competitor.id}>
                    {competitor.name}
                  </option>
                ))}
              </select>

              {sport.ratingKeys.map((rating) => {
                const value = team?.ratings[rating.key] ?? 70;
                return (
                  <label key={rating.key} className="block" title={rating.title}>
                    <span className="flex items-baseline justify-between text-xs">
                      <span className="tracking-wider text-emerald-100/50 uppercase">{rating.label}</span>
                      <span className="nums font-semibold text-white">{value}</span>
                    </span>
                    <input
                      type="range"
                      min={40}
                      max={99}
                      value={value}
                      onChange={(event) => setRating(id, rating.key, Number(event.target.value))}
                      className="mt-1.5 w-full accent-[var(--color-accent)]"
                    />
                  </label>
                );
              })}

              {ratings[id] ? (
                <Button
                  className="px-2.5 py-1 text-xs"
                  onClick={() =>
                    setRatings((current) => {
                      const next = { ...current };
                      delete next[id];
                      return next;
                    })
                  }
                >
                  Reset ratings
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy || sameTeam} onClick={run}>
          {busy ? 'Simulating…' : `Run ${runs.toLocaleString()} matches`}
        </Button>
        <span className="flex gap-1">
          {RUN_SIZES.map((size) => (
            <Button
              key={size}
              className={`px-2.5 py-1 text-xs ${runs === size ? 'border-accent/50 text-accent' : ''}`}
              onClick={() => setRuns(size)}
            >
              {size.toLocaleString()}
            </Button>
          ))}
        </span>
        {sameTeam ? <span className="text-xs text-amber-300/80">Pick two different teams.</span> : null}
      </div>

      {outcome ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={`${home?.short ?? 'Home'} win`} value={percent(outcome.homeWins, outcome.runs)} />
            <Stat label="Draw" value={percent(outcome.draws, outcome.runs)} />
            <Stat label={`${away?.short ?? 'Away'} win`} value={percent(outcome.awayWins, outcome.runs)} />
            <Stat
              label={`Average ${sport.scoreLabel.toLowerCase()}`}
              value={`${(outcome.homeScore / outcome.runs).toFixed(2)} – ${(outcome.awayScore / outcome.runs).toFixed(2)}`}
            />
          </div>

          <Card>
            <CardHeader title="Outcome split" subtitle={`${outcome.runs.toLocaleString()} simulated matches`} />
            <div className="px-5 py-5">
              <div className="flex h-7 overflow-hidden rounded-lg">
                {[
                  { key: 'home', value: outcome.homeWins, color: home?.color ?? '#34d97a', label: home?.short },
                  { key: 'draw', value: outcome.draws, color: '#3f5a4c', label: 'D' },
                  { key: 'away', value: outcome.awayWins, color: away?.color ?? '#6b7280', label: away?.short },
                ].map((segment) => (
                  <div
                    key={segment.key}
                    className="flex items-center justify-center text-[11px] font-semibold text-black/70"
                    style={{ width: `${(segment.value / outcome.runs) * 100}%`, background: segment.color }}
                    title={`${segment.label}: ${percent(segment.value, outcome.runs)}`}
                  >
                    {segment.value / outcome.runs > 0.08 ? percent(segment.value, outcome.runs) : ''}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Most likely scorelines" />
            <ul className="divide-y divide-pitch-800/60">
              {topScorelines.map(([scoreline, count]) => (
                <li key={scoreline} className="flex items-center gap-4 px-5 py-2.5 text-sm">
                  <span className="nums w-14 font-semibold text-white">{scoreline.replace('-', ' – ')}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-pitch-800">
                    <span
                      className="block h-full rounded-full bg-accent-dim"
                      style={{ width: `${(count / (topScorelines[0]?.[1] ?? 1)) * 100}%` }}
                    />
                  </span>
                  <span className="nums w-16 text-right text-xs text-emerald-100/50">
                    {percent(count, outcome.runs)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex items-center gap-3 px-5 py-10 text-sm text-emerald-100/50">
            <TeamDot color={home?.color} />
            <span>
              Set the ratings you want to test, then run a batch to see how often each result comes up.
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
