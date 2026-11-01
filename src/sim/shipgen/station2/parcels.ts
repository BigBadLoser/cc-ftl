import type { Grid } from './grid';
import { wrap } from './grid';

/**
 * Cutting a region into department parcels along the angle about the station's centre (radial cuts: on a ring, walls
 * that run from one corridor to the other). Parcels take floor in proportion to their weight; anchored parcels (a
 * harbour at its face) take a fixed arc centred on their anchor and the rest share the gaps between anchors.
 */

export interface Cut {
  key: string;
  weight: number;
  /** Fixed arc: centre angle and span (radians). */
  anchor?: { a: number; span: number };
  /** For a free item in a region with anchors: the gap it goes in (the gap after anchor k) and its order there. */
  gap?: number;
}

const TAU = 2 * Math.PI;
const norm = (a: number): number => ((a % TAU) + TAU) % TAU;

/** The start angle of a region's tiles in angle order: just past its widest empty arc (a full ring: `fallback`). */
export function startAngle(g: Grid, tiles: readonly number[], fallback: number): { start: number; full: boolean } {
  const as = tiles.map((i) => norm(g.a(i))).sort((p, q) => p - q);
  let gap = 0, at = fallback;
  for (let k = 0; k < as.length; k++) {
    const a = as[k] as number;
    const next = k + 1 < as.length ? (as[k + 1] as number) : (as[0] as number) + TAU;
    if (next - a > gap) { gap = next - a; at = next; }
  }
  return gap > 0.35 ? { start: norm(at), full: false } : { start: norm(fallback), full: true };
}

/** Split `tiles` in angle order from `start` into runs by weight. */
function byWeight(g: Grid, tiles: readonly number[], start: number, items: readonly Cut[]): Map<string, number[]> {
  const out = new Map<string, number[]>(items.map((c) => [c.key, []]));
  const order = [...tiles].sort((p, q) => norm(g.a(p) - start) - norm(g.a(q) - start) || g.r(p) - g.r(q));
  const total = items.reduce((t, c) => t + c.weight, 0) || 1;
  let acc = 0, k = 0;
  let edge = ((items[0]?.weight ?? 0) / total) * order.length;
  // Cuts fall between angles, never inside one tile column of equal angle.
  for (let j = 0; j < order.length; j++) {
    while (k < items.length - 1 && j >= edge) {
      // Keep tiles of (nearly) the same angle together.
      const prev = order[j - 1];
      if (prev !== undefined && Math.abs(wrap(g.a(order[j] as number) - g.a(prev))) < 1e-9) break;
      k++;
      acc += (items[k - 1] as Cut).weight;
      edge = ((acc + (items[k] as Cut).weight) / total) * order.length;
    }
    out.get((items[k] as Cut).key)?.push(order[j] as number);
  }
  return out;
}

/**
 * Cut a region. Without anchors: one run of items from the region's start angle. With anchors: anchored items take
 * their arcs, the free items fill the gaps (an empty gap is shared by its two anchored neighbours).
 */
export function cutRegion(g: Grid, tiles: readonly number[], items: readonly Cut[], fallback = 0): Map<string, number[]> {
  const anchors = items.filter((c) => c.anchor).sort((p, q) => norm((p.anchor as { a: number }).a) - norm((q.anchor as { a: number }).a));
  if (anchors.length === 0) return byWeight(g, tiles, startAngle(g, tiles, fallback).start, items);
  const out = new Map<string, number[]>(items.map((c) => [c.key, []]));
  const inArc = (a: number, c: Cut): boolean => {
    const { a: m, span } = c.anchor as { a: number; span: number };
    return Math.abs(wrap(a - m)) <= span / 2;
  };
  const rest: number[] = [];
  for (const i of tiles) {
    const c = anchors.find((x) => inArc(g.a(i), x));
    if (c) out.get(c.key)?.push(i); else rest.push(i);
  }
  anchors.forEach((c, k) => {
    const next = anchors[(k + 1) % anchors.length] as Cut;
    const a0 = norm((c.anchor as { a: number; span: number }).a + (c.anchor as { span: number }).span / 2);
    const a1raw = norm((next.anchor as { a: number; span: number }).a - (next.anchor as { span: number }).span / 2);
    const a1 = a1raw <= a0 ? a1raw + TAU : a1raw;
    const mine = rest.filter((i) => { const a = norm(g.a(i)); return (a >= a0 && a < a1) || (a + TAU >= a0 && a + TAU < a1); });
    const free = items.filter((x) => !x.anchor && x.gap === k);
    // An empty gap: half to each anchored neighbour.
    const run = free.length > 0 ? free : [{ key: c.key, weight: 1 }, { key: next.key, weight: 1 }];
    for (const [key, ts] of byWeight(g, mine, a0, run)) out.get(key)?.push(...ts);
  });
  return out;
}
