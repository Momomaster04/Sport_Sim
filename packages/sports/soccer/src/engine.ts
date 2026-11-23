import type { Competitor, Fixture, FixtureResult, LiveSim, Rng, SimEvent } from '@sportsim/core';

/** Multiplier applied to the home side's threat and possession share. */
const HOME_ADVANTAGE = 1.12;
/** Probability per minute that either side works a shooting chance. */
const CHANCE_RATE = 0.26;
/** Probability per minute of a foul, and of that foul being booked. */
const FOUL_RATE = 0.24;
const BOOKING_RATE = 0.18;
const SENDING_OFF_RATE = 0.012;

type Side = 0 | 1;

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
 * Expected goals for a single chance, from the attacking side's attack rating
 * against the defending side's defence rating. A balanced matchup sits near
 * 0.11, which over roughly 23 chances a game lands total goals in the 2.5-2.8
 * range real leagues tend to produce.
 */
function chanceQuality(attack: number, defence: number): number {
  return clamp(0.11 + ((attack - defence) / 100) * 0.09, 0.03, 0.3);
}

/**
 * A soccer match played out one minute at a time.
 *
 * The same object backs both modes: the live feed calls step() on a timer,
 * while a season sim runs it to completion immediately. Because both paths
 * consume the same generator in the same order, a match watched live always
 * ends exactly as the fast simulation would have ended it.
 */
export class SoccerMatch implements LiveSim {
  readonly duration: number;

  private minute = 0;
  private readonly sides: [SideState, SideState] = [newSide(), newSide()];
  private readonly log: SimEvent[] = [];
  private readonly homeThreatShare: number;
  private readonly possessionShare: number;

  constructor(
    private readonly fixture: Fixture,
    private readonly competitors: Competitor[],
    private readonly rng: Rng,
  ) {
    const [home, away] = competitors as [Competitor, Competitor];
    const boost = fixture.neutral ? 1 : HOME_ADVANTAGE;

    const homeThreat = ((home.ratings.attack ?? 70) * boost) / (away.ratings.defence ?? 70);
    const awayThreat = (away.ratings.attack ?? 70) / (home.ratings.defence ?? 70);
    this.homeThreatShare = homeThreat / (homeThreat + awayThreat);

    const homeMid = (home.ratings.midfield ?? 70) * boost;
    const awayMid = away.ratings.midfield ?? 70;
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
      emit(...this.playChance(minute));
    }

    if (this.rng.chance(FOUL_RATE)) {
      const side: Side = this.rng.chance(0.5) ? 0 : 1;
      const state = this.sides[side];
      state.fouls += 1;

      if (this.rng.chance(SENDING_OFF_RATE)) {
        state.red += 1;
        emit({ t: minute, type: 'red', competitorId: this.team(side).id, label: `${this.team(side).short} — red card`, detail: 'Down to ten men' });
      } else if (this.rng.chance(BOOKING_RATE)) {
        state.yellow += 1;
        emit({ t: minute, type: 'yellow', competitorId: this.team(side).id, label: `${this.team(side).short} — booked` });
      }
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

    return {
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
  }

  /** Resolve one shooting chance into a goal, a save, or a miss. */
  private playChance(minute: number): [SimEvent] {
    const side: Side = this.rng.chance(this.homeThreatShare) ? 0 : 1;
    const attacker = this.team(side);
    const defender = this.team(side === 0 ? 1 : 0);
    const state = this.sides[side];

    const quality = chanceQuality(attacker.ratings.attack ?? 70, defender.ratings.defence ?? 70);
    state.shots += 1;
    state.xg += quality;

    if (this.rng.chance(quality)) {
      state.sot += 1;
      state.score += 1;
      return [{
        t: minute,
        type: 'goal',
        competitorId: attacker.id,
        scoring: true,
        label: `GOAL — ${attacker.name}`,
        detail: this.scoreline(),
      }];
    }

    if (this.rng.chance(0.42)) {
      state.sot += 1;
      return [{ t: minute, type: 'save', competitorId: attacker.id, label: `${attacker.short} forces a save` }];
    }

    if (this.rng.chance(0.3)) {
      state.corners += 1;
      return [{ t: minute, type: 'corner', competitorId: attacker.id, label: `${attacker.short} win a corner` }];
    }

    return [{ t: minute, type: 'miss', competitorId: attacker.id, label: `${attacker.short} shoot wide` }];
  }

  private team(side: Side): Competitor {
    return this.competitors[side] as Competitor;
  }

  private scoreline(): string {
    const [home, away] = this.competitors as [Competitor, Competitor];
    return `${home.short} ${this.sides[0].score} - ${this.sides[1].score} ${away.short}`;
  }
}
