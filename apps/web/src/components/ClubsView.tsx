import type { Competitor, LeagueTemplate, Player, PlayerPosition, SportDefinition } from '@sportsim/core';
import { generateSquad } from '@sportsim/football';
import { useEffect, useRef, useState } from 'react';
import { cloneDataset, deleteDataset, exportDataset, importDataset, saveDataset } from '../datasets';
import { Button, Card, CardHeader, EmptyState, TeamDot } from './ui';

interface Props {
  sport: SportDefinition;
  datasets: LeagueTemplate[];
  active: LeagueTemplate;
  onSelect: (id: string) => void;
  onDatasetsChanged: (selectId?: string) => void;
}

const POSITIONS: PlayerPosition[] = ['GK', 'DF', 'MF', 'FW'];
const PLAYER_RATINGS = ['attack', 'creativity', 'defending', 'physical', 'keeping'] as const;

/** Trigger a browser download of a dataset as a JSON file. */
function download(league: LeagueTemplate): void {
  const blob = new Blob([exportDataset(league)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${league.id}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ClubsView({ sport, datasets, active, onSelect, onDatasetsChanged }: Props) {
  const [draft, setDraft] = useState<LeagueTemplate>(active);
  const [openClubId, setOpenClubId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  // Follow the dataset the rest of the app has open.
  useEffect(() => {
    setDraft(active);
    setOpenClubId(null);
  }, [active]);

  const readOnly = !draft.custom;
  const dirty = JSON.stringify(draft) !== JSON.stringify(active);
  const openClub = draft.competitors.find((club) => club.id === openClubId) ?? null;

  function updateClub(clubId: string, patch: Partial<Competitor>) {
    setDraft((current) => ({
      ...current,
      competitors: current.competitors.map((club) => (club.id === clubId ? { ...club, ...patch } : club)),
    }));
  }

  function updatePlayer(clubId: string, playerId: string, patch: Partial<Player>) {
    setDraft((current) => ({
      ...current,
      competitors: current.competitors.map((club) =>
        club.id === clubId
          ? {
              ...club,
              squad: (club.squad ?? []).map((player) =>
                player.id === playerId ? { ...player, ...patch, custom: true } : player,
              ),
            }
          : club,
      ),
    }));
  }

  function save() {
    saveDataset(draft);
    onDatasetsChanged(draft.id);
    setMessage('Saved.');
  }

  function startEditing() {
    const copy = cloneDataset(active, `${active.name} (copy)`, active.season ?? '');
    saveDataset(copy);
    onDatasetsChanged(copy.id);
    setMessage('Copied. You can edit this one.');
  }

  function newSeason() {
    const season = window.prompt('Which season is this? For example 2015/16', '2015/16');
    if (season === null) return;
    const copy = cloneDataset(active, active.name, season.trim() || 'Custom');
    saveDataset(copy);
    onDatasetsChanged(copy.id);
    setMessage(`Created ${copy.name} ${copy.season}. Edit the clubs and ratings to match that season.`);
  }

  function remove() {
    if (!window.confirm(`Delete "${draft.name} ${draft.season ?? ''}"? This cannot be undone.`)) return;
    deleteDataset(draft.id);
    onDatasetsChanged();
    setMessage('Deleted.');
  }

  async function onFile(file: File) {
    try {
      const imported = importDataset(await file.text());
      onDatasetsChanged(imported.id);
      setMessage(`Imported ${imported.name}${imported.season ? ` ${imported.season}` : ''}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'That file could not be imported.');
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Leagues and seasons"
          subtitle="Bundled seasons are read only. Copy one to edit it, or import your own."
        />

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <select
            value={active.id}
            onChange={(event) => onSelect(event.target.value)}
            className="rounded-lg border border-pitch-700/70 bg-pitch-800 px-3 py-2 text-sm text-emerald-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            {datasets.map((league) => (
              <option key={league.id} value={league.id}>
                {league.name}
                {league.season ? ` ${league.season}` : ''}
                {league.custom ? ' — yours' : ''}
              </option>
            ))}
          </select>

          <Button onClick={newSeason}>Add a season</Button>
          {readOnly ? <Button onClick={startEditing}>Copy to edit</Button> : null}
          <Button onClick={() => download(draft)}>Export</Button>
          <Button onClick={() => fileInput.current?.click()}>Import</Button>
          {!readOnly ? (
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          ) : null}

          <span className="ml-auto flex items-center gap-2">
            {dirty ? <span className="text-xs text-amber-300/80">Unsaved changes</span> : null}
            <Button variant="primary" disabled={readOnly || !dirty} onClick={save}>
              Save changes
            </Button>
          </span>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
              event.target.value = '';
            }}
          />
        </div>

        {message ? (
          <p className="border-t border-pitch-700/50 px-5 py-3 text-xs text-emerald-100/60">{message}</p>
        ) : null}

        {readOnly ? (
          <p className="border-t border-pitch-700/50 px-5 py-3 text-xs text-emerald-100/50">
            To build a historical season, open the closest one and choose <strong>Add a season</strong>. That copies
            the clubs and squads so you only have to change what actually differed that year.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={`${draft.name}${draft.season ? ` ${draft.season}` : ''}`}
            subtitle={`${draft.competitors.length} clubs`}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr className="text-[11px] tracking-wider text-emerald-100/40 uppercase">
                  <th className="py-2 pl-5 text-left font-medium">Club</th>
                  <th className="px-2 py-2 text-left font-medium">Abbr</th>
                  {sport.ratingKeys.map((rating) => (
                    <th key={rating.key} className="px-2 py-2 text-right font-medium" title={rating.title}>
                      {rating.label}
                    </th>
                  ))}
                  <th className="py-2 pr-5 text-right font-medium">Squad</th>
                </tr>
              </thead>
              <tbody>
                {draft.competitors.map((club) => (
                  <tr
                    key={club.id}
                    className={`border-t border-pitch-800/70 ${openClubId === club.id ? 'bg-pitch-800/50' : ''}`}
                  >
                    <td className="py-1.5 pl-5">
                      <span className="flex items-center gap-2">
                        <TeamDot color={club.color} />
                        <input
                          value={club.name}
                          disabled={readOnly}
                          onChange={(event) => updateClub(club.id, { name: event.target.value })}
                          className="w-40 rounded bg-transparent px-1 py-0.5 text-emerald-50 disabled:text-emerald-100/70 enabled:hover:bg-pitch-800 focus-visible:outline-1 focus-visible:outline-accent"
                        />
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={club.short}
                        disabled={readOnly}
                        maxLength={4}
                        onChange={(event) => updateClub(club.id, { short: event.target.value.toUpperCase() })}
                        className="w-12 rounded bg-transparent px-1 py-0.5 text-emerald-100/70 enabled:hover:bg-pitch-800 focus-visible:outline-1 focus-visible:outline-accent"
                      />
                    </td>
                    {sport.ratingKeys.map((rating) => (
                      <td key={rating.key} className="px-2 py-1.5 text-right">
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={club.ratings[rating.key] ?? 70}
                          disabled={readOnly}
                          onChange={(event) =>
                            updateClub(club.id, {
                              ratings: { ...club.ratings, [rating.key]: Number(event.target.value) },
                            })
                          }
                          className="nums w-14 rounded bg-transparent px-1 py-0.5 text-right text-emerald-100/80 enabled:hover:bg-pitch-800 focus-visible:outline-1 focus-visible:outline-accent"
                        />
                      </td>
                    ))}
                    <td className="py-1.5 pr-5 text-right">
                      <Button
                        className="px-2 py-0.5 text-[11px]"
                        onClick={() => setOpenClubId(openClubId === club.id ? null : club.id)}
                      >
                        {club.squad?.length ?? 0}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="self-start">
          {!openClub ? (
            <EmptyState
              title="No club open"
              body="Pick a squad size button to see and edit that club's players."
            />
          ) : (
            <>
              <CardHeader
                title={openClub.name}
                subtitle={`${openClub.squad?.length ?? 0} players`}
                action={
                  !readOnly ? (
                    <Button
                      className="px-2.5 py-1 text-xs"
                      onClick={() => updateClub(openClub.id, { squad: generateSquad(openClub, `${draft.id}:${Date.now()}`) })}
                    >
                      Regenerate
                    </Button>
                  ) : undefined
                }
              />
              <div className="max-h-[32rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-pitch-900">
                    <tr className="text-[11px] tracking-wider text-emerald-100/40 uppercase">
                      <th className="py-2 pl-5 text-left font-medium">#</th>
                      <th className="py-2 text-left font-medium">Player</th>
                      <th className="px-2 py-2 text-left font-medium">Pos</th>
                      {PLAYER_RATINGS.map((key) => (
                        <th key={key} className="px-1 py-2 text-right font-medium" title={key}>
                          {key.slice(0, 3).toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(openClub.squad ?? []).map((player) => (
                      <tr key={player.id} className="border-t border-pitch-800/60">
                        <td className="nums py-1 pl-5 text-xs text-emerald-100/35">{player.number}</td>
                        <td className="py-1">
                          <input
                            value={player.name}
                            disabled={readOnly}
                            onChange={(event) => updatePlayer(openClub.id, player.id, { name: event.target.value })}
                            className="w-36 rounded bg-transparent px-1 py-0.5 text-emerald-50 disabled:text-emerald-100/70 enabled:hover:bg-pitch-800 focus-visible:outline-1 focus-visible:outline-accent"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select
                            value={player.position}
                            disabled={readOnly}
                            onChange={(event) =>
                              updatePlayer(openClub.id, player.id, { position: event.target.value as PlayerPosition })
                            }
                            className="rounded bg-transparent px-1 py-0.5 text-xs text-emerald-100/70 enabled:hover:bg-pitch-800"
                          >
                            {POSITIONS.map((position) => (
                              <option key={position} value={position} className="bg-pitch-800">
                                {position}
                              </option>
                            ))}
                          </select>
                        </td>
                        {PLAYER_RATINGS.map((key) => (
                          <td key={key} className="px-1 py-1 text-right">
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={player.ratings[key] ?? 50}
                              disabled={readOnly}
                              onChange={(event) =>
                                updatePlayer(openClub.id, player.id, {
                                  ratings: { ...player.ratings, [key]: Number(event.target.value) },
                                })
                              }
                              className="nums w-11 rounded bg-transparent px-0.5 py-0.5 text-right text-xs text-emerald-100/75 enabled:hover:bg-pitch-800 focus-visible:outline-1 focus-visible:outline-accent"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
