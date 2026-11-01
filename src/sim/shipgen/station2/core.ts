import { Grid, K } from './grid';
import { planSpine } from './spine';

/**
 * The core centre slot (docs/STATIONGEN2.md, concentric): a department walled off inside the inner ring, entered from
 * it. Its occupant now is engineering, laid out on a straight spine; the slot's radius is the least that holds the
 * occupant's rooms that way (a rotunda or another occupant can plug in with its own radius).
 */

const cache = new Map<string, number>();

/** The least core radius whose disc holds these rect rooms on a straight spine with a guard post to the ring. */
export function coreRadius(sizes: readonly [number, number][]): number {
  const key = sizes.map(([w, h]) => `${w}x${h}`).sort().join(',');
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let r = 6;
  for (; r < 30; r++) {
    const g = new Grid(r + 4);
    const disc: number[] = [];
    for (let i = 0; i < g.kind.length; i++) {
      const d = g.r(i);
      if (d <= r + 0.5) { g.set(i, K.Free); disc.push(i); } else if (d <= r + 2.5) { g.set(i, K.Hall); g.pub[i] = 1; }
    }
    if (planSpine(g, disc, sizes)) break;
  }
  cache.set(key, r);
  return r;
}
