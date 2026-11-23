import {
  Rng,
  type Competitor,
  type Fixture,
  type FixtureResult,
  type LiveSim,
  type SportDefinition,
} from '@sportsim/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, CardHeader, EmptyState, TeamDot } from './ui';

interface Props {
  sport: SportDefinition;
  competitors: Competitor[];
}

const SPEEDS = [
  { label: 'Slow', ms: 320 },
  { label: 'Normal', ms: 120 },
  { label: 'Fast', ms: 35 },
] as const;

/** Events worth tinting in the feed. */
const EVENT_TONE: Record<string, string> = {
  goal: 'text-accent',
  red: 'text-red-300',
  yellow: 'text-amber-300',
  halftime: 'text-emerald-100/50',
  fulltime: 'text-white',
};

export function LiveView({ sport, competitors }: Props) {
  const [homeId, setHomeId] = useState(competitors[0]?.id ?? '');
  const [awayId, setAwayId] = useState(competitors[1]?.id ?? '');
  const [seed, setSeed] = useState('kickoff');
  const [speed, setSpeed] = useState<number>(SPEEDS[1].ms);
  const [playing, setPlaying] = useState(false);
  const [snapshot, setSnapshot] = useState<FixtureResult | null>(null);

  const sim = useRef<LiveSim | null>(null);
  const feedRef = useRef<HTMLOListElement | null>(null);

  // Reset whenever the matchup or seed changes, so the board never shows a
  // scoreline belonging to a different fixture.
  useEffect(() => {
    sim.current = null;
    setSnapshot(null);
    setPlaying(false);
  }, [homeId, awayId, seed]);

  const sides = useMemo(
    () => [homeId, awayId].map((id) => competitors.find((team) => team.id === id)).filter(Boolean) as Competitor[],
    [homeId, awayId, competitors],
  );

  const sameTeam = homeId === awayId;
  const done = sim.current?.done ?? false;

  function start() {
    if (sides.length !== 2) return;

    const fixture: Fixture = { id: `live-${homeId}-${awayId}`, round: 1, competitorIds: [homeId, awayId] };
    sim.current = sport.createLive(fixture, sides, new Rng(`${seed}:${homeId}:${awayId}`));
    setSnapshot(sim.current.snapshot());
    setPlaying(true);
  }

  function tick() {
    const current = sim.current;
    if (!current) return;

    current.step();
    setSnapshot(current.snapshot());
    if (current.done) setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(tick, speed);
    return () => window.clearInterval(timer);
    // `tick` reads from a ref, so it is safe to leave out of the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  // Keep the newest event in view as the match runs.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 });
  }, [snapshot?.events.length]);

  const scoreOf = (id: string) => snapshot?.competitors.find((side) => side.competitorId === id)?.score ?? 0;
  const statOf = (id: string, key: string) =>
    snapshot?.competitors.find((side) => side.competitorId === id)?.stats[key] ?? 0;

  const clock = sim.current?.clock ?? 0;
  const duration = sim.current?.duration ?? 90;
  const feed = snapshot ? [...snapshot.events].reverse() : [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Fixture" subtitle="Pick a matchup, then kick off" />
        <div className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_1fr_auto]">
          <TeamPicker label="Home" value={homeId} onChange={setHomeId} competitors={competitors} />
          <div className="hidden items-end pb-2 text-xs text-emerald-100/35 md:flex">vs</div>
          <TeamPicker label="Away" value={awayId} onChange={setAwayId} competitors={competitors} />
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-wider text-emerald-100/45 uppercase">Seed</span>
            <input
              value={seed}
              onChange={(event) => setSeed(event.target.value)}
              className="w-28 rounded-lg border border-pitch-700/70 bg-pitch-800 px-3 py-2 text-sm text-emerald-50 focus-visible:outline-2 focus-visible:outline-accent"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-pitch-700/50 px-5 py-3">
          <Button variant="primary" disabled={sameTeam} onClick={start}>
            {snapshot ? 'Restart match' : 'Kick off'}
          </Button>
          <Button disabled={!snapshot || done} onClick={() => setPlaying((value) => !value)}>
            {playing ? 'Pause' : 'Resume'}
          </Button>
          <Button disabled={!snapshot || done} onClick={tick}>
            Step a minute
          </Button>

          <span className="ml-auto flex gap-1">
            {SPEEDS.map((option) => (
              <Button
                key={option.label}
                className={`px-2.5 py-1 text-xs ${speed === option.ms ? 'border-accent/50 text-accent' : ''}`}
                onClick={() => setSpeed(option.ms)}
              >
                {option.label}
              </Button>
            ))}
          </span>
        </div>

        {sameTeam ? (
          <p className="px-5 pb-4 text-xs text-amber-300/80">Pick two different teams to start a match.</p>
        ) : null}
      </Card>

      {!snapshot ? (
        <Card>
          <EmptyState
            title="No match in progress"
            body="Choose two teams and kick off to watch the match play out minute by minute."
          />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between gap-4 px-5 py-6">
              <TeamScore competitor={sides[0]} score={scoreOf(homeId)} align="right" />
              <div className="shrink-0 text-center">
                <div className="nums text-xs text-emerald-100/45">
                  {clock}
                  <span className="text-emerald-100/25">/{duration}</span> {sport.clockUnit}
                </div>
                <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-pitch-800">
                  <div
                    className="h-full bg-accent transition-[width] duration-200"
                    style={{ width: `${Math.min(100, (clock / duration) * 100)}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] tracking-wider text-emerald-100/40 uppercase">
                  {done ? 'Full time' : playing ? 'Live' : 'Paused'}
                </div>
              </div>
              <TeamScore competitor={sides[1]} score={scoreOf(awayId)} align="left" />
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Play by play" subtitle={`${snapshot.events.length} events`} />
              {feed.length === 0 ? (
                <EmptyState title="Nothing yet" body="Events will appear here as the match progresses." />
              ) : (
                <ol ref={feedRef} className="max-h-80 divide-y divide-pitch-800/60 overflow-y-auto">
                  {feed.map((event, index) => (
                    <li
                      key={`${event.t}-${event.type}-${index}`}
                      className="flex items-baseline gap-3 px-5 py-2 text-sm"
                    >
                      <span className="nums w-10 shrink-0 text-xs text-emerald-100/35">
                        {event.t}
                        {sport.clockUnit === 'min' ? "'" : ''}
                      </span>
                      <span className="min-w-0">
                        <span className={EVENT_TONE[event.type] ?? 'text-emerald-50/85'}>{event.label}</span>
                        {event.detail ? (
                          <span className="nums ml-2 text-xs text-emerald-100/40">{event.detail}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <Card className="self-start">
              <CardHeader title="Box score" />
              <table className="w-full text-sm">
                <tbody>
                  {sport.boxScoreColumns.map((column) => (
                    <tr key={column.key} className="border-t border-pitch-800/60 first:border-t-0">
                      <td className="nums py-2 pl-5 text-right font-semibold text-white">
                        {statOf(homeId, column.key)}
                      </td>
                      <td className="py-2 text-center text-[11px] tracking-wider text-emerald-100/45 uppercase">
                        {column.label}
                      </td>
                      <td className="nums py-2 pr-5 text-left font-semibold text-white">
                        {statOf(awayId, column.key)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function TeamPicker({
  label,
  value,
  onChange,
  competitors,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  competitors: Competitor[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] tracking-wider text-emerald-100/45 uppercase">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-pitch-700/70 bg-pitch-800 px-3 py-2 text-sm text-emerald-50 focus-visible:outline-2 focus-visible:outline-accent"
      >
        {competitors.map((competitor) => (
          <option key={competitor.id} value={competitor.id}>
            {competitor.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TeamScore({
  competitor,
  score,
  align,
}: {
  competitor: Competitor | undefined;
  score: number;
  align: 'left' | 'right';
}) {
  return (
    <div className={`flex min-w-0 flex-1 flex-col gap-1 ${align === 'right' ? 'items-end text-right' : 'items-start'}`}>
      <span className="flex items-center gap-2">
        <TeamDot color={competitor?.color} />
        <span className="truncate text-sm text-emerald-100/70">{competitor?.name ?? '—'}</span>
      </span>
      <span className="nums text-5xl font-bold text-white">{score}</span>
    </div>
  );
}
