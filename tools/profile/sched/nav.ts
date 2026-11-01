/**
 * BENCHMARK PROTOTYPE (crew AI Phase 2 step 1, docs/CREW_AI.md 7.3): navigation views shared by the scheduler candidates. Throwaway: the chosen candidate is
 * rebuilt in src/sim/ai. A view is one ship window under one walker mode (`avoidThin`, `suited`): a passable mask (the exact `findPath` walk predicate, start
 * exemption aside), the step-cost class, and a 4-connected component labelling (the design's prefilter; the corner rule makes 8-connectivity reduce to 4).
 * Views are cached by the same inputs `findPath`'s failure memo keys on, so they are derived data only.
 */
import { DoorJam, isEvaWalkable, isWalkable } from '../../../src/sim/structure';
import { OPEN_KEY, walkInfo, type WalkInfo } from '../../../src/sim/modules/walk';
import { ModuleC } from '../../../src/sim/modules/components';
import { shipGrid } from '../../../src/sim/regions';
import { EVA_THIN_AIR_BELOW } from '../../../src/sim/tuning';
import type { Sim } from '../../../src/sim';
import type { PathGoal, Tile } from '../../../src/sim/crew/pathfind';

export const ORTHO = 10;
export const DIAG = 14;
const EXTERIOR = 4;
const NB: readonly (readonly [number, number])[] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];

export interface Mode { avoidThin: boolean; suited: boolean }

export interface View {
  ship: number;
  x0: number; y0: number; w: number; h: number;
  pass: Uint8Array;
  /** Step cost multiplier of entering a tile: 1 deck, 4 exterior. */
  mult: Uint8Array;
  label: Int32Array;
}

/** Counters the bench reads (searches, nodes popped, views built). */
export const stats = { astar: 0, dijkstra: 0, fields: 0, nodes: 0, views: 0, labelChecks: 0 };
export function resetStats(): void {
  for (const k of Object.keys(stats) as (keyof typeof stats)[]) stats[k] = 0;
}

const VIEWS = new WeakMap<object, Map<string, { sig: string; view: View }>>();
const THIN = new WeakMap<object, Map<string, { rev: number; h: number }>>();

function signature(sim: Sim, ship: number, mode: Mode): string {
  const grid = shipGrid(sim, ship)!;
  const g = sim.sector.grid;
  let sig = `${grid.x0},${grid.y0},${grid.width},${grid.height}|${g.revision('struct')}|${grid.has('jam') ? g.revision('jam') : 0}|${grid.has('module') ? g.revision('module') : 0}|${sim.world.query(ModuleC).length}`;
  if (mode.avoidThin && grid.has('o2')) {
    const rev = g.revision('o2');
    const id = `${grid.x0},${grid.y0},${grid.width},${grid.height}`;
    let m = THIN.get(g);
    if (!m) THIN.set(g, (m = new Map()));
    let hit = m.get(id);
    if (!hit || hit.rev !== rev) {
      const o2 = grid.load('o2');
      let h = 2166136261;
      for (let i = 0; i < o2.length; i++) h = Math.imul(h ^ ((o2[i] as number) < EVA_THIN_AIR_BELOW ? 1 : 0), 16777619);
      m.set(id, (hit = { rev, h }));
    }
    sig += `|${hit.h}`;
  }
  return sig;
}

/** The view of `ship` for `mode`, rebuilt only when what the walk predicate reads changed. */
export function viewOf(sim: Sim, ship: number, mode: Mode): View | null {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct')) return null;
  const key = `${ship}|${mode.avoidThin ? 1 : 0}${mode.suited ? 1 : 0}`;
  const sig = signature(sim, ship, mode);
  let m = VIEWS.get(sim.sector.grid);
  if (!m) VIEWS.set(sim.sector.grid, (m = new Map()));
  const hit = m.get(key);
  if (hit && hit.sig === sig) return hit.view;
  stats.views++;
  const { width: w, height: h, x0, y0 } = grid;
  const struct = grid.load('struct');
  const mods = grid.has('module') ? grid.load('module') : null;
  const jam = grid.has('jam') ? grid.load('jam') : null;
  const o2 = mode.avoidThin && grid.has('o2') ? grid.load('o2') : null;
  const infos = new Map<number, WalkInfo>();
  const pass = new Uint8Array(w * h);
  const mult = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const kind = struct[i] as number;
    const x = x0 + (i % w), y = y0 + Math.floor(i / w);
    mult[i] = isWalkable(kind) ? 1 : EXTERIOR;
    if (!isWalkable(kind) && !(mode.suited && isEvaWalkable(grid, x, y))) continue;
    if (jam && jam[i] === DoorJam.Shut) continue;
    if (o2 && (o2[i] as number) < EVA_THIN_AIR_BELOW) continue;
    const mm = mods ? (mods[i] as number) : 0;
    if (mm !== 0) {
      let info = infos.get(mm);
      if (!info) infos.set(mm, (info = walkInfo(sim, mm)));
      if (info.solid && !info.open.has(y * OPEN_KEY + x)) continue;
    }
    pass[i] = 1;
  }
  const label = new Int32Array(w * h);
  let next = 0;
  const stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!pass[s] || label[s]) continue;
    label[s] = ++next;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop() as number;
      const cx = c % w, cy = (c - cx) / w;
      if (cx > 0 && pass[c - 1] && !label[c - 1]) { label[c - 1] = next; stack.push(c - 1); }
      if (cx < w - 1 && pass[c + 1] && !label[c + 1]) { label[c + 1] = next; stack.push(c + 1); }
      if (cy > 0 && pass[c - w] && !label[c - w]) { label[c - w] = next; stack.push(c - w); }
      if (cy < h - 1 && pass[c + w] && !label[c + w]) { label[c + w] = next; stack.push(c + w); }
    }
  }
  const view = { ship, x0, y0, w, h, pass, mult, label };
  m.set(key, { sig, view });
  return view;
}

export const inView = (v: View, x: number, y: number): boolean => x >= v.x0 && y >= v.y0 && x < v.x0 + v.w && y < v.y0 + v.h;
export const idx = (v: View, x: number, y: number): number => (y - v.y0) * v.w + (x - v.x0);

/** Components a walker starting on `from` can reach (its own if passable, else those of its passable 4-neighbours). */
export function startLabels(v: View, from: Tile): number[] {
  if (!inView(v, from.x, from.y)) return [];
  const i = idx(v, from.x, from.y);
  if (v.pass[i]) return [v.label[i] as number];
  const out: number[] = [];
  const cx = from.x - v.x0, cy = from.y - v.y0;
  for (const [dx, dy] of NB.slice(0, 4)) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
    const l = v.label[ny * v.w + nx] as number;
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

const gapOf = (goal: PathGoal, x: number, y: number): number =>
  Math.max(goal.x - x, x - (goal.x + (goal.w ?? 1) - 1), goal.y - y, y - (goal.y + (goal.h ?? 1) - 1), 0);
export const isGoalTile = (goal: PathGoal, x: number, y: number): boolean => (goal.adjacent ? gapOf(goal, x, y) === 1 : x === goal.x && y === goal.y);

/** Window indices of the passable goal tiles of `goal` (the ring beside a box, or the tile itself). */
export function goalTiles(v: View, goal: PathGoal): number[] {
  const out: number[] = [];
  if (!goal.adjacent) {
    if (inView(v, goal.x, goal.y) && v.pass[idx(v, goal.x, goal.y)]) out.push(idx(v, goal.x, goal.y));
    return out;
  }
  const gw = goal.w ?? 1, gh = goal.h ?? 1;
  for (let y = goal.y - 1; y <= goal.y + gh; y++) {
    for (let x = goal.x - 1; x <= goal.x + gw; x++) {
      if (gapOf(goal, x, y) !== 1 || !inView(v, x, y)) continue;
      const i = idx(v, x, y);
      if (v.pass[i]) out.push(i);
    }
  }
  return out;
}

/** True when the walker on `from` reaches `goal` in this view (exactly `findPath(...) !== null`, bounds aside). */
export function reaches(v: View, from: Tile, starts: number[], goal: PathGoal): boolean {
  stats.labelChecks++;
  if (!inView(v, from.x, from.y) || !inView(v, goal.x, goal.y)) return false;
  if (!goal.adjacent && !v.pass[idx(v, goal.x, goal.y)] && !(goal.x === from.x && goal.y === from.y)) return false;
  if (isGoalTile(goal, from.x, from.y)) return true;
  for (const t of goalTiles(v, goal)) if (starts.includes(v.label[t] as number)) return true;
  return false;
}

/** Admissible octile bound on path cost (x10) to the goal; `lbSteps` the Chebyshev bound on the number of steps. */
export function octileBound(from: Tile, goal: PathGoal): number {
  const adj = goal.adjacent ? 1 : 0;
  const dx = Math.max(0, Math.max(goal.x - from.x, from.x - (goal.x + (goal.w ?? 1) - 1)) - adj);
  const dy = Math.max(0, Math.max(goal.y - from.y, from.y - (goal.y + (goal.h ?? 1) - 1)) - adj);
  return DIAG * Math.min(dx, dy) + ORTHO * Math.abs(dx - dy);
}
export function stepsBound(from: Tile, goal: PathGoal): number {
  return Math.max(0, gapOf(goal, from.x, from.y) - (goal.adjacent ? 1 : 0));
}

// --- searches: same scratch-generation trick as pathfind.ts ---
interface Scratch { g: Int32Array; parent: Int32Array; seen: Int32Array; done: Int32Array; gen: number }
const SCR = new Map<number, Scratch>();
function scratch(n: number): Scratch {
  let s = SCR.get(n);
  if (!s) SCR.set(n, (s = { g: new Int32Array(n), parent: new Int32Array(n), seen: new Int32Array(n), done: new Int32Array(n), gen: 0 }));
  if (s.gen >= 0x7ffffff0) { s.seen.fill(0); s.done.fill(0); s.gen = 0; }
  s.gen++;
  return s;
}

/** Heap of (f, h, index) lexicographic: identical order to pathfind.ts's MinHeap. */
class Heap {
  a: number[] = [];
  get size(): number { return this.a.length / 3; }
  push(f: number, h: number, i: number): void {
    const a = this.a;
    let k = a.length / 3;
    a.push(f, h, i);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (!this.less(k, p)) break;
      this.swap(k, p);
      k = p;
    }
  }
  pop(): number {
    const a = this.a;
    const top = a[2] as number;
    const last = a.length / 3 - 1;
    this.swap(0, last);
    a.length -= 3;
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
    const fx = a[3 * x] as number, fy = a[3 * y] as number;
    if (fx !== fy) return fx < fy;
    const hx = a[3 * x + 1] as number, hy = a[3 * y + 1] as number;
    if (hx !== hy) return hx < hy;
    return (a[3 * x + 2] as number) < (a[3 * y + 2] as number);
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

function withStart<T>(v: View, from: Tile, fn: (start: number) => T): T {
  const s = idx(v, from.x, from.y);
  const old = v.pass[s] as number;
  v.pass[s] = 1; // the start tile is always stood on (pathfind's thin-air start exemption)
  try {
    return fn(s);
  } finally {
    v.pass[s] = old;
  }
}

function expand(v: View, cur: number, visit: (ni: number, step: number) => void): void {
  const cx = cur % v.w, cy = (cur - cx) / v.w;
  for (const [dx, dy] of NB) {
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

/** A* on a view: the same expansion order and tie-breaks as `findPath`, so the same steps. Returns cost (x10) and steps, or null. */
export function astar(v: View, from: Tile, goal: PathGoal): { cost: number; steps: Tile[] } | null {
  stats.astar++;
  if (isGoalTile(goal, from.x, from.y)) return { cost: 0, steps: [] };
  return withStart(v, from, (start) => {
    if (!goal.adjacent && !v.pass[idx(v, goal.x, goal.y)]) return null;
    const sc = scratch(v.w * v.h);
    const { g, parent, seen, done, gen } = sc;
    const heap = new Heap();
    const hOf = (i: number): number => octileBound({ x: v.x0 + (i % v.w), y: v.y0 + Math.floor(i / v.w) }, goal);
    g[start] = 0;
    seen[start] = gen;
    heap.push(hOf(start), hOf(start), start);
    while (heap.size > 0) {
      const cur = heap.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      stats.nodes++;
      if (isGoalTile(goal, v.x0 + (cur % v.w), v.y0 + Math.floor(cur / v.w))) return { cost: g[cur] as number, steps: trace(v, parent, start, cur) };
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
    return null;
  });
}

/**
 * Multi-goal Dijkstra from one walker (candidate C): settles tiles in cost order until every goal tile in `goals` (window index -> goal ids) is settled.
 * Returns per goal id the best cost and the tile it is reached at, plus the parent array to trace a path (valid until the next search).
 */
export function dijkstraFrom(v: View, from: Tile, goals: Map<number, number[]>): { cost: Map<number, number>; steps: (id: number) => Tile[] } {
  stats.dijkstra++;
  const cost = new Map<number, number>();
  const at = new Map<number, number>();
  const all = new Set<number>();
  for (const ids of goals.values()) for (const id of ids) all.add(id);
  let left = all.size;
  const startI = idx(v, from.x, from.y);
  const parent = withStart(v, from, (start) => {
    const sc = scratch(v.w * v.h);
    const { g, parent, seen, done, gen } = sc;
    const heap = new Heap();
    g[start] = 0;
    seen[start] = gen;
    heap.push(0, 0, start);
    while (heap.size > 0 && left > 0) {
      const cur = heap.pop();
      if (done[cur] === gen) continue;
      done[cur] = gen;
      stats.nodes++;
      const ids = goals.get(cur);
      if (ids) for (const id of ids) if (!cost.has(id)) { cost.set(id, g[cur] as number); at.set(id, cur); left--; }
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
    return Int32Array.from(parent);
  });
  return { cost, steps: (id) => (at.has(id) ? trace(v, parent, startI, at.get(id) as number) : []) };
}

/**
 * Reverse Dijkstra field from a goal (candidate B): `f[i]` = cost from tile i to the goal (entering-tile costs, so reversed edges charge the tile being
 * left toward the goal). -1 = unreachable. Start exemption is not modelled: a walker on a blocked start tile reads its best neighbour plus the step.
 */
export function fieldTo(v: View, goal: PathGoal): Int32Array {
  stats.fields++;
  const n = v.w * v.h;
  const f = new Int32Array(n).fill(-1);
  const heap = new Heap();
  for (const t of goalTiles(v, goal)) {
    f[t] = 0;
    heap.push(0, 0, t);
  }
  const done = new Uint8Array(n);
  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur]) continue;
    done[cur] = 1;
    stats.nodes++;
    const fc = f[cur] as number;
    // A forward step p -> cur costs base * mult[cur]; walk the same neighbourhood backwards.
    expand(v, cur, (p) => {
      if (done[p]) return;
      const cx = cur % v.w, cy = (cur - cx) / v.w, px = p % v.w, py = (p - px) / v.w;
      const diag = cx !== px && cy !== py;
      const nf = fc + (diag ? DIAG : ORTHO) * (v.mult[cur] as number);
      if (f[p] !== -1 && nf >= (f[p] as number)) return;
      f[p] = nf;
      heap.push(nf, 0, p);
    });
  }
  return f;
}

/** Cost from `from` read off a field (handles a blocked start tile by its neighbours), or -1. */
export function fieldCost(v: View, f: Int32Array, from: Tile, goal: PathGoal): number {
  if (isGoalTile(goal, from.x, from.y)) return 0;
  if (!inView(v, from.x, from.y)) return -1;
  const s = idx(v, from.x, from.y);
  if (v.pass[s]) return f[s] as number;
  let best = -1;
  const cx = from.x - v.x0, cy = from.y - v.y0;
  for (const [dx, dy] of NB) {
    const nx = cx + dx, ny = cy + dy;
    if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
    const ni = ny * v.w + nx;
    if (!v.pass[ni] || (f[ni] as number) < 0) continue;
    const diag = dx !== 0 && dy !== 0;
    if (diag && (!v.pass[cy * v.w + nx] || !v.pass[ny * v.w + cx])) continue;
    const c = (f[ni] as number) + (diag ? DIAG : ORTHO) * (v.mult[ni] as number);
    if (best < 0 || c < best) best = c;
  }
  return best;
}

/** Steps by descending the field (ties by neighbour order). */
export function fieldPath(v: View, f: Int32Array, from: Tile, goal: PathGoal): Tile[] {
  const out: Tile[] = [];
  let cur = { x: from.x, y: from.y };
  for (let guard = 0; guard < v.w * v.h && !isGoalTile(goal, cur.x, cur.y); guard++) {
    const cx = cur.x - v.x0, cy = cur.y - v.y0;
    const here = v.pass[cy * v.w + cx] ? (f[cy * v.w + cx] as number) : Infinity;
    let best: Tile | null = null, bestC = Infinity;
    for (const [dx, dy] of NB) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= v.w || ny >= v.h) continue;
      const ni = ny * v.w + nx;
      if (!v.pass[ni] || (f[ni] as number) < 0) continue;
      const diag = dx !== 0 && dy !== 0;
      if (diag && (!v.pass[cy * v.w + nx] || !v.pass[ny * v.w + cx])) continue;
      const step = (diag ? DIAG : ORTHO) * (v.mult[ni] as number);
      const c = (f[ni] as number) + step;
      if (c < bestC && (here === Infinity || (f[ni] as number) < here)) { bestC = c; best = { x: v.x0 + nx, y: v.y0 + ny }; }
    }
    if (!best) break;
    out.push(best);
    cur = best;
  }
  return out;
}
