import { OPEN_KEY, walkInfo, type WalkInfo } from '../modules/walk';
import { EVA_THIN_AIR_BELOW } from '../tuning';
import { DoorJam, isEvaWalkable, isWalkable } from '../structure';
import type { Sim } from '../sim';
import { shipGrid } from '../regions';

export interface Tile {
  x: number;
  y: number;
}

export interface PathGoal extends Tile {
  /** True: stop on any walkable tile 8-adjacent to (x, y) (for working on walls). */
  adjacent?: boolean;
  /** With `adjacent`: the goal is the w x h box whose top-left is (x, y), and the walker stops beside the box, never inside it. */
  w?: number;
  h?: number;
}

// Integer costs (x10) keep the search exact and tie-breaking deterministic.
const ORTHO = 10;
const DIAG = 14;
/** Exterior (EVA) tiles cost this many times a deck tile, so suited crew only route outside when inside is no reasonable way. */
export const EXTERIOR_COST = 4;
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1],
];

/** Walker conditions for findPath. */
export interface PathOpts {
  /** Treat tiles with thin air (EVA_THIN_AIR_BELOW) as walls, except the start tile. */
  avoidThin?: boolean;
  /** The walker wears a spacesuit: the exterior surface (isEvaWalkable) is walkable. */
  suited?: boolean;
}

/**
 * A* on one grid. 8 directions, no corner cutting. Returns the steps after `from` (empty if
 * already at the goal) or null if unreachable. Ties break on f, then h, then tile index.
 * Takes shipId so portal-spanning paths can extend this later.
 */
export function findPath(sim: Sim, shipId: number, from: Tile, goal: PathGoal, opts: PathOpts = {}): Tile[] | null {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct') || !grid.inBounds(from.x, from.y) || !grid.inBounds(goal.x, goal.y)) return null;
  const { width, height, x0, y0 } = grid;
  // The search runs on window indices, i = (y - y0) * width + (x - x0): the tie-break order is the same in any frame.
  const struct = grid.load('struct');
  const mods = grid.has('module') ? grid.load('module') : null;
  const jam = grid.has('jam') ? grid.load('jam') : null;
  const infos = new Map<number, WalkInfo>();
  const o2 = opts.avoidThin && grid.has('o2') ? grid.load('o2') : null;
  const walk = (i: number): boolean => {
    const kind = struct[i] as number;
    const x = x0 + (i % width), y = y0 + Math.floor(i / width);
    if (!isWalkable(kind) && !(opts.suited && isEvaWalkable(grid, x, y))) return false;
    if (jam && jam[i] === DoorJam.Shut) return false;
    if (o2 && (o2[i] as number) < EVA_THIN_AIR_BELOW && i !== fromIndex) return false;
    const m = mods ? (mods[i] as number) : 0;
    if (m === 0) return true;
    let info = infos.get(m);
    if (!info) infos.set(m, (info = walkInfo(sim, m)));
    return !info.solid || info.open.has(y * OPEN_KEY + x);
  };
  const at = (x: number, y: number): number => (y - y0) * width + (x - x0);
  const fromIndex = at(from.x, from.y);
  const adj = goal.adjacent ? 1 : 0;
  const gw = goal.w ?? 1, gh = goal.h ?? 1;
  const gap = (x: number, y: number): number =>
    Math.max(goal.x - x, x - (goal.x + gw - 1), goal.y - y, y - (goal.y + gh - 1), 0);
  const isGoal = (x: number, y: number): boolean => (adj ? gap(x, y) === 1 : x === goal.x && y === goal.y);
  if (!adj && !walk(at(goal.x, goal.y))) return null;
  if (isGoal(from.x, from.y)) return [];

  const heuristic = (x: number, y: number): number => {
    const dx = Math.max(0, Math.max(goal.x - x, x - (goal.x + gw - 1)) - adj);
    const dy = Math.max(0, Math.max(goal.y - y, y - (goal.y + gh - 1)) - adj);
    return DIAG * Math.min(dx, dy) + ORTHO * Math.abs(dx - dy);
  };

  const sc = scratchFor(width * height);
  const { g, parent, seen, done } = sc;
  const gen = nextGen(sc);
  const gOf = (i: number): number => (seen[i] === gen ? (g[i] as number) : -1);
  const heap = new MinHeap();
  const start = fromIndex;
  g[start] = 0;
  seen[start] = gen;
  heap.push(heuristic(from.x, from.y), heuristic(from.x, from.y), start);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (done[cur] === gen) continue;
    done[cur] = gen;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    if (isGoal(x0 + cx, y0 + cy)) {
      const out: Tile[] = [];
      for (let i = cur; i !== start; i = parent[i] as number) out.push({ x: x0 + (i % width), y: y0 + Math.floor(i / width) });
      return out.reverse();
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (done[ni] === gen || !walk(ni)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!walk(cy * width + nx) || !walk(ny * width + cx))) continue;
      const step = (diagonal ? DIAG : ORTHO) * (isWalkable(struct[ni] as number) ? 1 : EXTERIOR_COST);
      const ng = (g[cur] as number) + step;
      const old = gOf(ni);
      if (old !== -1 && ng >= old) continue;
      g[ni] = ng;
      seen[ni] = gen;
      parent[ni] = cur;
      const h = heuristic(x0 + nx, y0 + ny);
      heap.push(ng + h, h, ni);
    }
  }
  return null;
}

/**
 * Working arrays of one grid size, reused across calls. `seen` / `done` hold the generation of the search that last set a tile's
 * g / closed flag, so a new search needs no clearing (a tile not stamped with the current generation reads as unvisited).
 */
interface Scratch {
  g: Int32Array;
  parent: Int32Array;
  seen: Int32Array;
  done: Int32Array;
  gen: number;
}
const SCRATCH = new Map<number, Scratch>();

function scratchFor(size: number): Scratch {
  let sc = SCRATCH.get(size);
  if (!sc) SCRATCH.set(size, (sc = { g: new Int32Array(size), parent: new Int32Array(size), seen: new Int32Array(size), done: new Int32Array(size), gen: 0 }));
  return sc;
}

function nextGen(sc: Scratch): number {
  if (sc.gen >= 0x7fffffff) {
    sc.seen.fill(0);
    sc.done.fill(0);
    sc.gen = 0;
  }
  return ++sc.gen;
}

/** Binary min-heap of (f, h, index) ordered lexicographically. */
class MinHeap {
  private f: number[] = [];
  private h: number[] = [];
  private idx: number[] = [];

  get size(): number {
    return this.idx.length;
  }

  push(f: number, h: number, index: number): void {
    let i = this.idx.length;
    this.f.push(f);
    this.h.push(h);
    this.idx.push(index);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.idx[0] as number;
    const last = this.idx.length - 1;
    this.swap(0, last);
    this.f.pop();
    this.h.pop();
    this.idx.pop();
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let m = i;
      if (l < last && this.less(l, m)) m = l;
      if (r < last && this.less(r, m)) m = r;
      if (m === i) break;
      this.swap(i, m);
      i = m;
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    const fa = this.f[a] as number;
    const fb = this.f[b] as number;
    if (fa !== fb) return fa < fb;
    const ha = this.h[a] as number;
    const hb = this.h[b] as number;
    if (ha !== hb) return ha < hb;
    return (this.idx[a] as number) < (this.idx[b] as number);
  }

  private swap(a: number, b: number): void {
    for (const arr of [this.f, this.h, this.idx]) {
      const t = arr[a] as number;
      arr[a] = arr[b] as number;
      arr[b] = t;
    }
  }
}
