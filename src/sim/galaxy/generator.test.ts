import { describe, expect, it } from 'vitest';
import { GalaxyGen, chunkKey } from './generator';
import { convexOverlap, dist } from './geometry';
import { HULL_GAP, SITE_SPACING } from './tuning';
import type { ChunkData, EdgeData, SectorData } from './types';

/** Chunks in a square of radius r around the origin, generated in the given order by a fresh generator. */
function build(seed: number, r: number, order: 'rows' | 'reverse' | 'spiral' = 'rows'): Map<string, ChunkData> {
  const gen = new GalaxyGen(seed, undefined);
  const keys: [number, number][] = [];
  for (let cy = -r; cy <= r; cy++) for (let cx = -r; cx <= r; cx++) keys.push([cx, cy]);
  if (order === 'reverse') keys.reverse();
  if (order === 'spiral') keys.sort((a, b) => Math.hypot(b[0], b[1]) - Math.hypot(a[0], a[1]) || a[0] - b[0] || a[1] - b[1]);
  const out = new Map<string, ChunkData>();
  for (const [cx, cy] of keys) out.set(chunkKey(cx, cy), gen.chunk(cx, cy));
  return out;
}

const canonical = (m: Map<string, ChunkData>) => JSON.stringify([...m.keys()].sort().map((k) => m.get(k)));

describe('galaxy generation', () => {
  it('is deterministic per seed and differs between seeds', () => {
    expect(canonical(build(7, 1))).toBe(canonical(build(7, 1)));
    expect(canonical(build(7, 1))).not.toBe(canonical(build(8, 1)));
  });

  it('gives the same galaxy whatever order chunks are generated in', () => {
    const a = canonical(build(3, 2, 'rows'));
    expect(canonical(build(3, 2, 'reverse'))).toBe(a);
    expect(canonical(build(3, 2, 'spiral'))).toBe(a);
    // A lone far chunk generated first by a fresh generator matches the same chunk generated amid its neighbours.
    const lone = new GalaxyGen(3, undefined).chunk(2, -1);
    expect(JSON.stringify(lone)).toBe(JSON.stringify(build(3, 2).get('2,-1')));
  });

  it('builds a hyperlane across a chunk seam identically from both sides', () => {
    const chunks = build(11, 2);
    const byId = new Map<string, EdgeData[]>();
    for (const c of chunks.values()) for (const e of c.edges) if (e.kind === 'hyperlane') byId.set(e.id, [...(byId.get(e.id) ?? []), e]);
    const shared = [...byId.values()].filter((l) => l.length > 1);
    expect(shared.length).toBeGreaterThan(10);
    for (const l of shared) expect(JSON.stringify(l[1])).toBe(JSON.stringify(l[0]));
  });

  it('keeps sector sites apart and hulls from overlapping, across chunk borders too', () => {
    const sectors: SectorData[] = [...build(5, 3).values()].flatMap((c) => c.sectors);
    expect(sectors.length).toBeGreaterThan(200);
    let checked = 0;
    for (let i = 0; i < sectors.length; i++) {
      for (let j = i + 1; j < sectors.length; j++) {
        const a = sectors[i] as SectorData;
        const b = sectors[j] as SectorData;
        const d = dist(a, b);
        expect(d).toBeGreaterThanOrEqual(SITE_SPACING.core - 1e-6);
        if (d > a.r + b.r + 200) continue;
        checked++;
        expect(a.r + b.r).toBeLessThanOrEqual(d - HULL_GAP + 1e-6);
        expect(convexOverlap(a.hull, b.hull), `${a.id} / ${b.id}`).toBe(false);
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('connects every sector inside and the whole region through hyperlanes', () => {
    const chunks = build(9, 3);
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
    expect(inner.length).toBeGreaterThan(1000);
    expect(inner.filter((n) => !reach.has(n.id)).map((n) => n.id)).toEqual([]);
  });

  it('prices hyperlanes cheaper per distance than routes', () => {
    const edges = [...build(2, 1).values()].flatMap((c) => c.edges);
    const per = (k: string) => {
      const l = edges.filter((e) => e.kind === k);
      return l.reduce((t, e) => t + e.fuel, 0) / l.reduce((t, e) => t + e.length, 0);
    };
    expect(per('hyperlane')).toBeLessThan(per('route'));
    for (const e of edges) expect(e.fuel).toBeGreaterThanOrEqual(1);
  });

  it('pins the start node at the origin with danger 0', () => {
    const start = build(4, 0).get('0,0')?.nodes.find((n) => n.id === 's.0.0.n0');
    expect(start).toMatchObject({ x: 0, y: 0, danger: 0 });
  });
});
