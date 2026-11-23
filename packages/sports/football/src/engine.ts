import type {
  Competitor,
  Fixture,
  FixtureResult,
  LiveSim,
  Player,
  PlayerStatLine,
  Rng,
  SimEvent,
} from '@sportsim/core';
import { effectiveRatings, startingEleven } from './squad';

/** Multiplier applied to the home side's threat and possession share. */
const HOME_ADVANTAGE = 1.12;
/** Probability per minute that either side works a shooting chance. */
const CHANCE_RATE = 0.26;
/** Probability per minute of a foul, and of that foul being punished. */
const FOUL_RATE = 0.24;
const BOOKING_RATE = 0.18;
const SENDING_OFF_RATE = 0.012;
/** Share of goals that come with an assist. */
const ASSIST_RATE = 0.72;

type Side = 0 | 1;

/** How likely each position is to score, and to create, relative to the rest. */
const SCORING_WEIGHT: Record<string, number> = { FW: 1, MF: 0.42, DF: 0.13, GK: 0 };
const CREATING_WEIGHT: Record<string, number> = { FW: 0.7, MF: 1, DF: 0.32, GK: 0.04 };
const FOULING_WEIGHT: Record<string, number> = { FW: 0.55, MF: 1, DF: 0.95, GK: 0.08 };

interface SideState {
  score: number;
  shots: number;
  sot: number;
  xg: number;
  corners: number;
  fouls: number;
  yellow: number;
  red: number;
  possession: number;
}

function newSide(): SideState {
  return { score: 0, shots: 0, sot: 0, xg: 0, corners: 0, fouls: 0, yellow: 0, red: 0, possession: 0 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Expected goals for a single chance.
 *
 * Built from the attacking side's attack rating against the defending side's
 * defence, then nudged by the goalkeeper behind it. A balanced matchup sits
 * near 0.11, which over roughly 23 chances a game lands total goals in the
 * 2.5-2.8 range real leagues produce.
 */
function chanceQuality(attack: number, defence: number, keeping: number): number {
  const base = 0.11 + ((attack - defence) / 100) * 0.09;
  const keeperEffect = ((70 - keeping) / 100) * 0.03;
  return clamp(base + keeperEffect, 0.03, 0.3);
}

/**
 * A football match played out one minute at a time.
 *
 * The same object backs both modes: the live feed calls step() on a timer,
 * while a season sim runs it to completion immediately. Because both paths
 * consume the same generator in the same order, a match watched live always
 * ends exactly as the fast simulation would have ended it.
 *
 * When clubs carry squads, strength is derived from the eleven they field and
 * every goal, assist, save and card is attributed to a named player. Clubs
 * without squads fall back to their own ratings and simply record no player
 * lines, which keeps the engine usable for quick what-if matchups.
 */
export class FootballMatch implements LiveSim {
  readonly duration: number;

  private minute = 0;
  private readonly sides: [SideState, SideState] = [newSide(), newSide()];
  private readonly log: SimEvent[] = [];
  private readonly elevens: [Player[], Player[]];
  private readonly playerStats = new Map<string, Record<string, number>>();
  private readonly homeThreatShare: number;
  private readonly possessionShare: number;
  private readonly ratings: [Record<string, number>, Record<string, number>];

  constructor(
    private readonly fixture: Fixture,
    private readonly competitors: Competitor[],
    private readonly rng: Rng,
  ) {
    const [home, away] = competitors as [Competitor, Competitor];
    this.elevens = [startingEleven(home.squad ?? []), startingEleven(away.squad ?? [])];
    this.ratings = [effectiveRatings(home), effectiveRatings(away)];

    const boost = fixture.neutral ? 1 : HOME_ADVANTAGE;
    const [homeRatings, awayRatings] = this.ratings;

    const homeThreat = ((homeRatings.attack ?? 70) * boost) / (awayRatings.defence ?? 70);
    const awayThreat = (awayRatings.attack ?? 70) / (homeRatings.defence ?? 70);
    this.homeThreatShare = homeThreat / (homeThreat + awayThreat);

    const homeMid = (homeRatings.midfield ?? 70) * boost;
    const awayMid = awayRatings.midfield ?? 70;
    this.possessionShare = homeMid / (homeMid + awayMid);

    // Added time, drawn up front so live and fast sims agree on the final whistle.
    this.duration = 90 + this.rng.int(2, 6);
  }

  get clock(): number {
    return this.minute;
  }

  get done(): boolean {
    return this.minute >= this.duration;
  }

  step(): SimEvent[] {
    if (this.done) return [];

    this.minute += 1;
    const minute = this.minute;
    const produced: SimEvent[] = [];
    const emit = (event: SimEvent) => {
      produced.push(event);
      this.log.push(event);
    };

    // Possession is tracked per minute so the final percentage drifts around
    // the modelled share rather than reporting it exactly.
    this.sides[this.rng.chance(this.possessionShare) ? 0 : 1].possession += 1;

    if (this.rng.chance(CHANCE_RATE)) {
      for (const event of this.playChance(minute)) emit(event);
    }

    if (this.rng.chance(FOUL_RATE)) {
      for (const event of this.playFoul(minute)) emit(event);
    }

    if (minute === 45) {
      emit({ t: 45, type: 'halftime', label: `Half time: ${this.scoreline()}` });
    }
    if (this.done) {
      emit({ t: this.duration, type: 'fulltime', label: `Full time: ${this.scoreline()}` });
    }

    return produced;
  }

  snapshot(): FixtureResult {
    const totalPossession = this.sides[0].possession + this.sides[1].possession || 1;

    const result: FixtureResult = {
      fixtureId: this.fixture.id,
      round: this.fixture.round,
      inProgress: !this.done,
      events: [...this.log],
      competitors: this.competitors.map((competitor, index) => {
        const state = this.sides[index as Side];
        return {
          competitorId: competitor.id,
          score: state.score,
          stats: {
            shots: state.shots,
            sot: state.sot,
            xg: Math.round(state.xg * 100) / 100,
            corners: state.corners,
            fouls: state.fouls,
            yellow: state.yellow,
            red: state.red,
            possession: Math.round((state.possession / totalPossession) * 100),
          },
        };
      }),
    };

    const players = this.playerLines();
    if (players.length > 0) result.players = players;
    return result;
  }

  /** The eleven each side started, for the UI to show a line-up. */
  lineups(): [Player[], Player[]] {
    return [[...this.elevens[0]], [...this.elevens[1]]];
  }

  private playerLines(): PlayerStatLine[] {
    const lines: PlayerStatLine[] = [];

    for (const side of [0, 1] as Side[]) {
      const competitorId = this.team(side).id;
      for (const player of this.elevens[side]) {
        const stats = this.playerStats.get(player.id);
        if (stats) lines.push({ playerId: player.id, competitorId, stats: { ...stats } });
      }
    }

    return lines;
  }

  /** Resolve one shooting chance into a goal, a save, or a miss. */
  private playChance(minute: number): SimEvent[] {
    const side: Side = this.rng.chance(this.homeThreatShare) ? 0 : 1;
    const defendingSide: Side = side === 0 ? 1 : 0;
    const attacker = this.team(side);
    const state = this.sides[side];

    const quality = chanceQuality(
      this.ratings[side].attack ?? 70,
      this.ratings[defendingSide].defence ?? 70,
      this.ratings[defendingSide].keeping ?? 70,
    );

    state.shots += 1;
    state.xg += quality;

    const shooter = this.pickBy(side, SCORING_WEIGHT, 'attack');
    if (shooter) this.bump(shooter.id, 'shots');

    if (this.rng.chance(quality)) {
      state.sot += 1;
      state.score += 1;

      const events: SimEvent[] = [];
      if (shooter) this.bump(shooter.id, 'goals');

      const assister =
        shooter && this.rng.chance(ASSIST_RATE)
          ? this.pickBy(side, CREATING_WEIGHT, 'creativity', shooter.id)
          : undefined;
      if (assister) this.bump(assister.id, 'assists');

      events.push({
        t: minute,
        type: 'goal',
        competitorId: attacker.id,
        ...(shooter ? { playerId: shooter.id } : {}),
        scoring: true,
        label: shooter ? `GOAL — ${shooter.name} (${attacker.short})` : `GOAL — ${attacker.name}`,
        detail: assister ? `${this.scoreline()} · assist ${assister.name}` : this.scoreline(),
      });
      return events;
    }

    if (this.rng.chance(0.42)) {
      state.sot += 1;
      const keeper = this.elevens[defendingSide][0];
      if (keeper) this.bump(keeper.id, 'saves');

      return [{
        t: minute,
        type: 'save',
        competitorId: attacker.id,
        ...(shooter ? { playerId: shooter.id } : {}),
        label: shooter
          ? `${shooter.name} forces a save${keeper ? ` from ${keeper.name}` : ''}`
          : `${attacker.short} forces a save`,
      }];
    }

    if (this.rng.chance(0.3)) {
      state.corners += 1;
      return [{ t: minute, type: 'corner', competitorId: attacker.id, label: `${attacker.short} win a corner` }];
    }

    return [{
      t: minute,
      type: 'miss',
      competitorId: attacker.id,
      ...(shooter ? { playerId: shooter.id } : {}),
      label: shooter ? `${shooter.name} shoots wide` : `${attacker.short} shoot wide`,
    }];
  }

  /** Resolve a foul, which may be waved on, booked, or a sending off. */
  private playFoul(minute: number): SimEvent[] {
    const side: Side = this.rng.chance(0.5) ? 0 : 1;
    const state = this.sides[side];
    const team = this.team(side);
    state.fouls += 1;

    const offender = this.pickBy(side, FOULING_WEIGHT, 'physical');
    if (offender) this.bump(offender.id, 'fouls');

    if (this.rng.chance(SENDING_OFF_RATE)) {
      state.red += 1;
      if (offender) this.bump(offender.id, 'red');
      return [{
        t: minute,
        type: 'red',
        competitorId: team.id,
        ...(offender ? { playerId: offender.id } : {}),
        label: offender ? `RED — ${offender.name} (${team.short})` : `${team.short} — red card`,
        detail: 'Down to ten men',
      }];
    }

    if (this.rng.chance(BOOKING_RATE)) {
      state.yellow += 1;
      if (offender) this.bump(offender.id, 'yellow');
      return [{
        t: minute,
        type: 'yellow',
        competitorId: team.id,
        ...(offender ? { playerId: offender.id } : {}),
        label: offender ? `${offender.name} booked (${team.short})` : `${team.short} — booked`,
      }];
    }

    return [];
  }

  /**
   * Pick a player from an eleven, weighted by position and the given rating.
   *
   * Returns undefined when the club has no squad, which is how the engine
   * stays usable for ratings-only matchups.
   */
  private pickBy(
    side: Side,
    positionWeights: Record<string, number>,
    ratingKey: string,
    excludeId?: string,
  ): Player | undefined {
    const candidates = this.elevens[side].filter((player) => player.id !== excludeId);
    if (candidates.length === 0) return undefined;

    return this.rng.weighted(candidates, (player) => {
      const positional = positionWeights[player.position] ?? 0;
      if (positional <= 0) return 0;
      // Square the rating share so better players pull clear of squad filler.
      const quality = (player.ratings[ratingKey] ?? 50) / 100;
      return positional * quality * quality;
    });
  }

  private bump(playerId: string, key: string): void {
    const stats = this.playerStats.get(playerId) ?? {};
    stats[key] = (stats[key] ?? 0) + 1;
    this.playerStats.set(playerId, stats);
  }

  private team(side: Side): Competitor {
    return this.competitors[side] as Competitor;
  }

  private scoreline(): string {
    const [home, away] = this.competitors as [Competitor, Competitor];
    return `${home.short} ${this.sides[0].score} - ${this.sides[1].score} ${away.short}`;
  }
}
