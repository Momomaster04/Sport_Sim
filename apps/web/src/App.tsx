import { createSeason, type LeagueTemplate, type Season, type SportId } from '@sportsim/core';
import { useCallback, useEffect, useState } from 'react';
import { ClubsView } from './components/ClubsView';
import { LiveView } from './components/LiveView';
import { SandboxView } from './components/SandboxView';
import { SeasonView } from './components/SeasonView';
import { Card, EmptyState, Tab } from './components/ui';
import { listDatasets } from './datasets';
import { SPORTS, sportEntry } from './sports';
import { clearSeason, loadSeason, loadSelectedDataset, saveSeason, saveSelectedDataset } from './storage';

type Mode = 'season' | 'live' | 'sandbox' | 'clubs';

const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'season', label: 'Season' },
  { id: 'live', label: 'Live match' },
  { id: 'sandbox', label: 'Sandbox' },
  { id: 'clubs', label: 'Clubs & seasons' },
];

export function App() {
  const [sportId, setSportId] = useState<SportId>('football');
  const [mode, setMode] = useState<Mode>('season');
  const [datasets, setDatasets] = useState<LeagueTemplate[]>([]);
  const [activeId, setActiveId] = useState('');
  const [season, setSeason] = useState<Season | null>(null);

  const entry = sportEntry(sportId);
  const sport = entry.definition;
  const active = datasets.find((league) => league.id === activeId);

  /** Re-read the dataset list, optionally switching to a particular one. */
  const refreshDatasets = useCallback(
    (selectId?: string) => {
      const list = listDatasets(sportId);
      setDatasets(list);

      const preferred = selectId ?? loadSelectedDataset(sportId);
      const pick = list.find((league) => league.id === preferred) ?? list[0];
      setActiveId(pick?.id ?? '');
    },
    [sportId],
  );

  useEffect(() => {
    refreshDatasets();
  }, [refreshDatasets]);

  // Load the saved season for this dataset, or start a fresh one.
  useEffect(() => {
    if (!sport || !active) {
      setSeason(null);
      return;
    }
    saveSelectedDataset(sportId, active.id);
    setSeason(loadSeason(sportId, active.id) ?? createSeason(sport, { league: active }));
  }, [sport, sportId, active]);

  useEffect(() => {
    if (season) saveSeason(season);
  }, [season]);

  function resetSeason() {
    if (!sport || !active) return;
    clearSeason(sportId, active.id);
    setSeason(createSeason(sport, { league: active }));
  }

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sport<span className="text-accent">Sim</span>
          </h1>
          <p className="mt-0.5 text-sm text-emerald-100/50">
            Seeded match and season simulation. Same seed, same season, every time.
          </p>
        </div>

        {datasets.length > 1 && mode !== 'clubs' ? (
          <label className="flex items-center gap-2 text-xs text-emerald-100/50">
            Season
            <select
              value={activeId}
              onChange={(event) => setActiveId(event.target.value)}
              className="rounded-lg border border-pitch-700/70 bg-pitch-800 px-3 py-1.5 text-sm text-emerald-50 focus-visible:outline-2 focus-visible:outline-accent"
            >
              {datasets.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                  {league.season ? ` ${league.season}` : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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

      {!sport ? (
        <Card>
          <EmptyState
            title={`${entry.label} is not ready yet`}
            body="The engine for this sport is still being built. Football is playable now, and the others plug into the same core once their match models are done."
          />
        </Card>
      ) : (
        <>
          <nav aria-label="Mode" className="flex gap-1 overflow-x-auto">
            {MODES.map((option) => (
              <Tab key={option.id} active={option.id === mode} onClick={() => setMode(option.id)}>
                {option.label}
              </Tab>
            ))}
          </nav>

          <main className="flex-1">
            {mode === 'clubs' && active ? (
              <ClubsView
                sport={sport}
                datasets={datasets}
                active={active}
                onSelect={setActiveId}
                onDatasetsChanged={refreshDatasets}
              />
            ) : null}

            {mode !== 'clubs' && season ? (
              <>
                {mode === 'season' ? (
                  <SeasonView sport={sport} season={season} onChange={setSeason} onReset={resetSeason} />
                ) : null}
                {mode === 'live' ? <LiveView sport={sport} competitors={season.competitors} /> : null}
                {mode === 'sandbox' ? <SandboxView sport={sport} competitors={season.competitors} /> : null}
              </>
            ) : null}

            {mode !== 'clubs' && !season ? (
              <Card>
                <EmptyState title="No season loaded" body="Pick a league in Clubs & seasons to get started." />
              </Card>
            ) : null}
          </main>
        </>
      )}

      <footer className="border-t border-pitch-800/70 pt-4 text-xs text-emerald-100/30">
        Club names identify real teams; ratings are estimates and are meant to be edited. Seasons are saved in this
        browser only.
      </footer>
    </div>
  );
}
