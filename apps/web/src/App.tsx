import { createSeason, type Season, type SportId } from '@sportsim/core';
import { useEffect, useState } from 'react';
import { LiveView } from './components/LiveView';
import { SandboxView } from './components/SandboxView';
import { SeasonView } from './components/SeasonView';
import { Card, EmptyState, Tab } from './components/ui';
import { SPORTS, sportEntry } from './sports';
import { clearSeason, loadSeason, saveSeason } from './storage';

type Mode = 'season' | 'live' | 'sandbox';

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'season', label: 'Season' },
  { id: 'live', label: 'Live match' },
  { id: 'sandbox', label: 'Sandbox' },
];

export function App() {
  const [sportId, setSportId] = useState<SportId>('football');
  const [mode, setMode] = useState<Mode>('season');
  const [season, setSeason] = useState<Season | null>(null);

  const entry = sportEntry(sportId);
  const sport = entry.definition;

  // Pick up a saved season for this sport, or start a fresh one.
  useEffect(() => {
    if (!sport) {
      setSeason(null);
      return;
    }
    setSeason(loadSeason(sportId) ?? createSeason(sport));
  }, [sportId, sport]);

  useEffect(() => {
    if (season) saveSeason(season);
  }, [season]);

  function resetSeason() {
    if (!sport) return;
    clearSeason(sportId);
    setSeason(createSeason(sport));
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sport<span className="text-accent">Sim</span>
          </h1>
          <p className="mt-0.5 text-sm text-emerald-100/50">
            Seeded match and season simulation. Same seed, same season, every time.
          </p>
        </div>
      </header>

      <nav aria-label="Sport" className="flex gap-1 overflow-x-auto rounded-xl bg-pitch-900/60 p-1.5">
        {SPORTS.map((candidate) => (
          <Tab
            key={candidate.id}
            active={candidate.id === sportId}
            disabled={!candidate.definition}
            hint={candidate.definition ? candidate.note : `${candidate.label} — ${candidate.note}`}
            onClick={() => setSportId(candidate.id)}
          >
            {candidate.label}
          </Tab>
        ))}
      </nav>

      {!sport || !season ? (
        <Card>
          <EmptyState
            title={`${entry.label} is not ready yet`}
            body="The engine for this sport is still being built. Football is playable now, and the others plug into the same core once their match models are done."
          />
        </Card>
      ) : (
        <>
          <nav aria-label="Mode" className="flex gap-1">
            {MODES.map((option) => (
              <Tab key={option.id} active={option.id === mode} onClick={() => setMode(option.id)}>
                {option.label}
              </Tab>
            ))}
          </nav>

          <main className="flex-1">
            {mode === 'season' ? (
              <SeasonView sport={sport} season={season} onChange={setSeason} onReset={resetSeason} />
            ) : null}
            {mode === 'live' ? <LiveView sport={sport} competitors={season.competitors} /> : null}
            {mode === 'sandbox' ? <SandboxView sport={sport} competitors={season.competitors} /> : null}
          </main>
        </>
      )}

      <footer className="border-t border-pitch-800/70 pt-4 text-xs text-emerald-100/30">
        Clubs and ratings are fictional. Seasons are saved in this browser only.
      </footer>
    </div>
  );
}
