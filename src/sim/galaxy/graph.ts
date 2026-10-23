import type { Sim } from '../sim';
import { galaxyIndex, type GalaxyIndex } from './state';
import { REACH_HOPS } from './tuning';

/**
 * Hop-distance queries over the generated map, for NPC movement. A node's reach (everything within REACH_HOPS jumps, nearest first, with
 * the way back) is cached per galaxy index, so it is dropped whenever new chunks are generated. Deterministic: levels are sorted by
 * node id and neighbours follow the ascending edge ids of the index.
 */
export interface Reach {
  /** Nodes within the radius, nearest first (ties by id). The start is first. */
  order: string[];
  dist: Map<string, number>;
  /** Each node's predecessor on a shortest path from the start. */
  prev: Map<string, string>;
}

function explore(index: GalaxyIndex, from: string, hops: number): Reach {
  const reach: Reach = { order: [], dist: new Map(), prev: new Map() };
  if (!index.nodes.has(from)) return reach;
  reach.dist.set(from, 0);
  reach.order.push(from);
  let frontier = [from];
  for (let h = 1; h <= hops && frontier.length; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of index.adjacent.get(id) ?? []) {
        const o = e.a === id ? e.b : e.a;
        if (reach.dist.has(o)) continue;
        reach.dist.set(o, h);
        reach.prev.set(o, id);
        next.push(o);
      }
    }
    frontier = next.sort();
    reach.order.push(...frontier);
  }
  return reach;
}

const caches = new WeakMap<GalaxyIndex, Map<string, Reach>>();

/** Everything within REACH_HOPS jumps of `from` (cached; do not modify). */
export function reachFrom(sim: Sim, from: string): Reach {
  const index = galaxyIndex(sim.galaxy);
  let cache = caches.get(index);
  if (!cache) caches.set(index, (cache = new Map()));
  let r = cache.get(from);
  if (!r) cache.set(from, (r = explore(index, from, REACH_HOPS)));
  return r;
}

/** Node ids within `hops` jumps of `from` over generated edges, with their distance. */
export function nodesWithin(sim: Sim, from: string, hops: number): Map<string, number> {
  const r = hops <= REACH_HOPS ? reachFrom(sim, from) : explore(galaxyIndex(sim.galaxy), from, hops);
  const out = new Map<string, number>();
  for (const id of r.order) {
    const d = r.dist.get(id) as number;
    if (d > hops) break;
    out.set(id, d);
  }
  return out;
}

/** The nodes to visit, in order, to go from `from` to `to` by the fewest jumps (`from` excluded). Empty when `to` is out of reach or is `from`. */
export function pathTo(sim: Sim, from: string, to: string): string[] {
  const r = reachFrom(sim, from);
  if (!r.dist.has(to)) return [];
  const path: string[] = [];
  for (let n = to; n !== from; n = r.prev.get(n) as string) path.unshift(n);
  return path;
}
