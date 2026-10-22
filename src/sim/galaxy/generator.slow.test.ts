import { describe, expect, it } from 'vitest';
import { GalaxyGen, chunkKey } from './generator';
import { convexOverlap, dist } from './geometry';
import { HULL_GAP, SITE_SPACING } from './tuning';
import type { ChunkData, SectorData } from './types';

/** Chunks in a square of radius r around the origin (7x7 and 9x9 here: the slow tier). */
function build(seed: number, r: number): Map<string, ChunkData> {
  const gen = new GalaxyGen(seed, undefined);
  const out = new Map<string, ChunkData>();
  for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) out.set(chunkKey(cx, cy), gen.chunk(cx, cy));
  return out;
}

describe('galaxy generation, large squares', () => {
  it('keeps sector sites apart and hulls from overlapping, across chunk borders too', () => {
    const sectors: SectorData[] = [...build(5, 3).values()].flatMap((c) => c.sectors);
    expect(sectors.length).toBeGreaterThan(50);
    let checked = 0;
    for (let i = 0; i < sectors.length; i++) {
      for (let j = i + 1; j < sectors.length; j++) {
        const a = sectors[i] as SectorData;
        const b = sectors[j] as SectorData;
        const d = dist(a, b);
        expect(d).toBeGreaterThanOrEqual(SITE_SPACING.core - 1e-6);
        if (d > a.r + b.r + 500) continue;
        checked++;
        expect(a.r + b.r).toBeLessThanOrEqual(d - HULL_GAP + 1e-6);
        expect(convexOverlap(a.hull, b.hull), `${a.id} / ${b.id}`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(40);
  });

  it('connects every sector inside and the whole cluster through hyperlanes', () => {
    // Clusters and their detours are large, so build well past the inner square that is checked.
    const chunks = build(9, 4);
    const nodes = new Set([...chunks.values()].flatMap((c) => c.nodes.map((n) => n.id)));
    const adj = new Map<string, string[]>();
    for (const c of chunks.values()) {
      for (const e of c.edges) {
        if (!nodes.has(e.a) || !nodes.has(e.b)) continue;
        adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
        adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
      }
    }
    const reach = new Set(['s.0.0.n0']);
    const todo = ['s.0.0.n0'];
    while (todo.length) {
      for (const n of adj.get(todo.pop() as string) ?? []) {
        if (reach.has(n)) continue;
        reach.add(n);
        todo.push(n);
      }
    }
    // Everything in the inner 5x5 chunks (well away from the cut edge of the generated square) is reachable.
    const inner = [...chunks.values()].filter((c) => Math.abs(c.cx) <= 2 && Math.abs(c.cy) <= 2).flatMap((c) => c.nodes);
    expect(inner.length).toBeGreaterThan(100);
    expect(inner.filter((n) => !reach.has(n.id)).map((n) => n.id)).toEqual([]);
  });
});
