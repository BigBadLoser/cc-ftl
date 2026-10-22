import { describe, expect, it } from 'vitest';
import { GalaxyGen, chunkKey } from './generator';
import type { ChunkData, EdgeData } from './types';

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
