/**
 * Seeded pseudo-random number generator.
 *
 * Every simulation in this project is driven by one of these, which means a
 * given seed always replays the exact same match. That makes results shareable,
 * testable, and debuggable.
 */
export class Rng {
  private state: number;

  constructor(seed: number | string) {
    this.state = typeof seed === 'string' ? Rng.hash(seed) : seed >>> 0;
    // Avoid the degenerate all-zero state.
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Turn an arbitrary string into a usable 32-bit seed. */
  static hash(text: string): number {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Uniform float in [0, 1). mulberry32. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with the given probability. */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Pick one element uniformly. Throws on an empty list. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick called with an empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /**
   * Pick one element with probability proportional to its weight.
   * Weights must be non-negative and sum to more than zero.
   */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
    if (items.length === 0) throw new Error('Rng.weighted called with an empty list');
    let total = 0;
    for (const item of items) total += Math.max(0, weightOf(item));
    if (total <= 0) return this.pick(items);

    let roll = this.next() * total;
    for (const item of items) {
      roll -= Math.max(0, weightOf(item));
      if (roll <= 0) return item;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher-Yates, returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }

  /** Standard normal sample via Box-Muller. */
  normal(mean = 0, stdDev = 1): number {
    // u must be strictly positive for the log.
    const u = 1 - this.next();
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /**
   * Poisson sample by Knuth's method. Fine for the small lambdas this project
   * uses (goals per match, roughly 0-5).
   */
  poisson(lambda: number): number {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let count = 0;
    let product = this.next();
    while (product > limit && count < 100) {
      count += 1;
      product *= this.next();
    }
    return count;
  }
}
