import { describe, expect, it } from 'vitest';
import { sortByKeys } from './depthSort';

/** A seeded generator, so a failure repeats. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** The reference: item indices sorted by key, then tie. */
function reference(keys: number[], ties: number[]): number[] {
  return keys.map((_, i) => i).sort((x, y) => (keys[x] as number) - (keys[y] as number) || (ties[x] as number) - (ties[y] as number));
}

function run(keys: number[], ties: number[], budget?: number): number[] {
  const a = keys.map((_, i) => i);
  const k = new Float64Array(keys.length + 5); // longer than n, as the layer's buffers are
  const t = new Float64Array(keys.length + 5);
  k.set(keys);
  t.set(ties);
  sortByKeys(a, k, t, keys.length, budget);
  const ref = reference(keys, ties);
  expect(Array.from(k.slice(0, keys.length))).toEqual(ref.map((i) => keys[i]));
  expect(Array.from(t.slice(0, keys.length))).toEqual(ref.map((i) => ties[i]));
  return a;
}

describe('sortByKeys', () => {
  it('sorts nearly sorted input (a few items moved, many equal keys) by key then tie', () => {
    const r = rng(1);
    for (let n = 0; n < 50; n++) {
      const keys = Array.from({ length: 300 }, (_, i) => Math.floor(i / 4));
      const ties = keys.map((_, i) => i);
      for (let m = 0; m < 5; m++) {
        const i = Math.floor(r() * keys.length);
        keys[i] = Math.floor(r() * 80) + (r() < 0.5 ? 0.25 : 0);
        ties[i] = r() < 0.5 ? -1 - m : 1000 + m; // came from a lower band, or newly attached
      }
      expect(run(keys, ties)).toEqual(reference(keys, ties));
    }
  });

  it('gives the same order when it gives up and sorts from scratch', () => {
    const r = rng(2);
    for (let n = 0; n < 50; n++) {
      const keys = Array.from({ length: 200 }, () => Math.floor(r() * 20));
      const ties = keys.map(() => r());
      const want = reference(keys, ties);
      expect(run(keys, ties)).toEqual(want);
      expect(run(keys, ties, 3)).toEqual(want);
      expect(run(keys, ties, 0)).toEqual(want);
    }
  });

  it('handles empty and single inputs', () => {
    expect(run([], [])).toEqual([]);
    expect(run([5], [0])).toEqual([0]);
  });
});
