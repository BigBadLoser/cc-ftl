/**
 * Seeded PRNG (mulberry32). State is a single uint32, so it serializes as a number.
 * The sim owns exactly one Rng; nothing in src/sim may use Math.random.
 */
export class Rng {
  private state: number;

  /** @param seed any integer; it is coerced to uint32. */
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('Rng.pick: empty array');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Serializable state. */
  getState(): number {
    return this.state;
  }

  /** Restore a state previously returned by getState(). */
  setState(state: number): void {
    this.state = state >>> 0;
  }
}
