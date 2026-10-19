import { galaxyIndex } from './state';
import type { EdgeData, GalaxyState } from './types';

export interface PlannedRoute {
  /** Node ids from the start to the destination, both included. */
  path: string[];
  edges: EdgeData[];
  fuel: number;
  /** Sum of FTL charge over every jump (each jump needs its own charge). */
  charge: number;
  time: number;
}

interface Entry {
  fuel: number;
  time: number;
  node: string;
}

const before = (a: Entry, b: Entry): boolean =>
  a.fuel !== b.fuel ? a.fuel < b.fuel : a.time !== b.time ? a.time < b.time : a.node < b.node;

/** A tiny binary heap ordered by (fuel, time, node id), so equal routes always resolve the same way. */
class Heap {
  private items: Entry[] = [];
  get size(): number {
    return this.items.length;
  }
  push(e: Entry): void {
    const a = this.items;
    a.push(e);
    for (let i = a.length - 1; i > 0;) {
      const p = (i - 1) >> 1;
      if (!before(a[i] as Entry, a[p] as Entry)) break;
      [a[i], a[p]] = [a[p] as Entry, a[i] as Entry];
      i = p;
    }
  }
  pop(): Entry {
    const a = this.items;
    const top = a[0] as Entry;
    const last = a.pop() as Entry;
    if (a.length) {
      a[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && before(a[l] as Entry, a[m] as Entry)) m = l;
        if (r < a.length && before(a[r] as Entry, a[m] as Entry)) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m] as Entry, a[i] as Entry];
        i = m;
      }
    }
    return top;
  }
}

/**
 * Cheapest route by fuel, ties broken by travel time (then node id), over generated nodes. With `known` (default) the
 * route keeps to discovered nodes, so the player can only plot through space their sensors have seen.
 */
export function planStarRoute(g: GalaxyState, from: string, to: string, opts: { known?: boolean } = {}): PlannedRoute | null {
  const index = galaxyIndex(g);
  const known = opts.known ?? true;
  const ok = (id: string) => index.nodes.has(id) && (!known || g.discovered[id] !== undefined || id === from);
  if (!ok(from) || !ok(to)) return null;
  const best = new Map<string, Entry>([[from, { fuel: 0, time: 0, node: from }]]);
  const via = new Map<string, EdgeData>();
  const heap = new Heap();
  heap.push({ fuel: 0, time: 0, node: from });
  while (heap.size) {
    const cur = heap.pop();
    const rec = best.get(cur.node);
    if (rec && before(rec, cur)) continue;
    if (cur.node === to) break;
    for (const e of index.adjacent.get(cur.node) ?? []) {
      const next = e.a === cur.node ? e.b : e.a;
      if (!ok(next)) continue;
      const cand = { fuel: cur.fuel + e.fuel, time: Math.round((cur.time + e.time) * 10) / 10, node: next };
      const old = best.get(next);
      if (old && !before(cand, old)) continue;
      best.set(next, cand);
      via.set(next, e);
      heap.push(cand);
    }
  }
  if (!best.has(to)) return null;
  const path = [to];
  const edges: EdgeData[] = [];
  for (let n = to; n !== from;) {
    const e = via.get(n) as EdgeData;
    edges.unshift(e);
    n = e.a === n ? e.b : e.a;
    path.unshift(n);
  }
  const end = best.get(to) as Entry;
  return { path, edges, fuel: end.fuel, charge: edges.reduce((t, e) => t + e.charge, 0), time: end.time };
}

/** The edge joining two nodes directly, if any. */
export function edgeBetween(g: GalaxyState, a: string, b: string): EdgeData | undefined {
  return galaxyIndex(g).adjacent.get(a)?.find((e) => e.a === b || e.b === b);
}
