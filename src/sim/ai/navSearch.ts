import type { PathGoal, Tile } from '../crew/pathfind';
import { DIAG, ORTHO, indexOf, isFallbackStop, isGoalTile, octileBound, type View } from './navView';

/**
 * Searches on a navigation view (ai/navView.ts) for the scheduler. `astar` is `findPath` on the view: the same expansion order and
 * tie-breaks (f, then h, then tile index), so the same steps. `dijkstraFrom` settles tiles from one walker in cost order until every goal it
 * was given is settled (one search answers all of a crew member's candidate jobs). Costs are `findPath`'s integers (x10, exterior x4). Both
 * treat a doorway beside an `adjacent` goal as `findPath` does (#248): the first one settled is kept as a fallback and the search goes on
 * for a proper stop, which wins whatever its cost.
 */

const NEIGHBOURS: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

/** Working arrays of one window size, reused; a tile not stamped with the current generation reads as unvisited. */
interface Scratch {
  g: Int32Array;
  parent: Int32Array;
  seen: Int32Array;
  done: Int32Array;
  gen: number;
}
const SCRATCH = new Map<number, Scratch>();
function scratch(n: number): Scratch {
  let s = SCRATCH.get(n);
  if (!s) SCRATCH.set(n, (s = { g: new Int32Array(n), parent: new Int32Array(n), seen: new Int32Array(n), done: new Int32Array(n), gen: 0 }));
  if (s.gen >= 0x7ffffff0) {
    s.seen.fill(0);
    s.done.fill(0);
    s.gen = 0;
  }
  s.gen++;
  return s;
}

/** Binary min-heap of (f, h, index) triples, lexicographic. */
class Heap {
  private a: number[] = [];
  get size(): number {
    return this.a.length / 3;
  }
  push(f: number, h: number, i: number): void {
    let k = this.a.length / 3;
    this.a.push(f, h, i);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!this.less(k, p)) break;
      this.swap(k, p);
      k = p;
    }
  }
  pop(): number {
    const top = this.a[2] as number;
    const last = this.a.length / 3 - 1;
    this.swap(0, last);
    this.a.length -= 3;
    let k = 0;
    for (;;) {
      const l = 2 * k + 1, r = l + 1;
      let m = k;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === k) break;
      this.swap(k, m);
      k = m;
    }
    return top;
  }
  private less(x: number, y: number): boolean {
    const a = this.a;
    for (let k = 0; k < 3; k++) {
      const p = a[3 * x + k] as number, q = a[3 * y + k] as number;
      if (p !== q) return p < q;
    }
    return false;
  }
  private swap(x: number, y: number): void {
    const a = this.a;
    for (let k = 0; k < 3; k++) {
      const t = a[3 * x + k] as number;
      a[3 * x + k] = a[3 * y + k] as number;
      a[3 * y + k] = t;
    }
  }
}

/** Run `fn` with the start tile passable when only thin air blocks it (`findPath`'s start exemption). */
function withStart<T>(v: View, from: Tile, fn: (start: number) => T): T {
  const s = indexOf(v, from.x, from.y);
  const old = v.pass[s] as number;
  if (v.thinOnly[s]) v.pass[s] = 1;
  try {
    return fn(s);
  } finally {
    v.pass[s] = old;
  }
}

/** Visit the passable neighbours of `cur` in `findPath`'s order, with no corner cutting. */
function expand(v: View, cur: number, visit: (ni: number, step: number) => void): void {
  const cx = cur % v.w, cy = (cur - cx) / v.w;
  for (const [dx, dy] of NEIGHBOURS) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
    const ni = ny * v.w + nx;
    if (!v.pass[ni]) continue;
    const diag = dx !== 0 && dy !== 0;
    if (diag && (!v.pass[cy * v.w + nx] || !v.pass[ny * v.w + cx])) continue;
    visit(ni, (diag ? DIAG : ORTHO) * (v.mult[ni] as number));
  }
}

function trace(v: View, parent: Int32Array, start: number, end: number): Tile[] {
  const out: Tile[] = [];
  for (let i = end; i !== start; i = parent[i] as number) out.push({ x: v.x0 + (i % v.w), y: v.y0 + Math.floor(i / v.w) });
  return out.reverse();
}

/** Cost (x10) and steps of the path `findPath` would return, or null. `from` and the goal must be in the view. */
export function astar(v: View, from: Tile, goal: PathGoal): { cost: number; steps: Tile[] } | null {
  if (isGoalTile(goal, from.x, from.y)) return { cost: 0, steps: [] };
  return withStart(v, from, (start) => {
    if (!goal.adjacent && !v.pass[indexOf(v, goal.x, goal.y)]) return null;
    const { g, parent, seen, done, gen } = scratch(v.w * v.h);
    const heap = new Heap();
    const hOf = (i: number): number => octileBound({ x: v.x0 + (i % v.w), y: v.y0 + Math.floor(i / v.w) }, goal);
    g[start] = 0;
    seen[start] = gen;
    heap.push(hOf(start), hOf(start), start);
    let doorEnd = -1;
    while (heap.size > 0) {
      const cur = heap.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      if (isGoalTile(goal, v.x0 + (cur % v.w), v.y0 + Math.floor(cur / v.w))) {
        if (!isFallbackStop(v, goal, cur)) return { cost: g[cur] as number, steps: trace(v, parent, start, cur) };
        if (doorEnd < 0) doorEnd = cur;
      }
      const gc = g[cur] as number;
      expand(v, cur, (ni, step) => {
        if (done[ni] === gen) return;
        const ng = gc + step;
        if (seen[ni] === gen && ng >= (g[ni] as number)) return;
        g[ni] = ng;
        seen[ni] = gen;
        parent[ni] = cur;
        const h = hOf(ni);
        heap.push(ng + h, h, ni);
      });
    }
    return doorEnd >= 0 ? { cost: g[doorEnd] as number, steps: trace(v, parent, start, doorEnd) } : null;
  });
}

/**
 * Multi-goal Dijkstra from one walker. `goals` maps a window index to the keys reached there, `fallbacks` the doorway stops (see above)
 * likewise. Returns each key's cost (x10) and a way to trace its steps; a key never reached is absent. Stops once every key has a proper stop.
 */
export function dijkstraFrom(
  v: View,
  from: Tile,
  goals: Map<number, number[]>,
  fallbacks: Map<number, number[]> = new Map(),
): { cost: Map<number, number>; steps: (key: number) => Tile[] } {
  const cost = new Map<number, number>();
  const at = new Map<number, number>();
  const fbCost = new Map<number, number>();
  const fbAt = new Map<number, number>();
  const keys = new Set<number>();
  for (const ks of goals.values()) for (const k of ks) keys.add(k);
  for (const ks of fallbacks.values()) for (const k of ks) keys.add(k);
  let left = keys.size;
  const startI = indexOf(v, from.x, from.y);
  const parent = withStart(v, from, (start) => {
    const { g, parent, seen, done, gen } = scratch(v.w * v.h);
    const heap = new Heap();
    g[start] = 0;
    seen[start] = gen;
    heap.push(0, 0, start);
    while (heap.size > 0 && left > 0) {
      const cur = heap.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      for (const k of goals.get(cur) ?? []) {
        if (cost.has(k)) continue;
        cost.set(k, g[cur] as number);
        at.set(k, cur);
        left--;
      }
      for (const k of fallbacks.get(cur) ?? []) {
        if (cost.has(k) || fbAt.has(k)) continue;
        fbCost.set(k, g[cur] as number);
        fbAt.set(k, cur);
      }
      const gc = g[cur] as number;
      expand(v, cur, (ni, step) => {
        if (done[ni] === gen) return;
        const ng = gc + step;
        if (seen[ni] === gen && ng >= (g[ni] as number)) return;
        g[ni] = ng;
        seen[ni] = gen;
        parent[ni] = cur;
        heap.push(ng, 0, ni);
      });
    }
    for (const [k, i] of fbAt) {
      if (cost.has(k)) continue;
      cost.set(k, fbCost.get(k) as number);
      at.set(k, i);
    }
    return at.size > 0 ? Int32Array.from(parent) : parent;
  });
  return { cost, steps: (k) => (at.has(k) ? trace(v, parent, startI, at.get(k) as number) : []) };
}
