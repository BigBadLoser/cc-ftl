import { OPEN_KEY, walkInfo, type WalkInfo } from '../modules/walk';
import { EVA_THIN_AIR_BELOW } from '../tuning';
import { isEvaWalkable, isWalkable } from '../structure';
import type { Sim } from '../sim';

export interface Tile {
  x: number;
  y: number;
}

export interface PathGoal extends Tile {
  /** True: stop on any walkable tile 8-adjacent to (x, y) (for working on walls). */
  adjacent?: boolean;
}

// Integer costs (x10) keep the search exact and tie-breaking deterministic.
const ORTHO = 10;
const DIAG = 14;
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
 * Takes gridId so portal-spanning paths can extend this later.
 */
export function findPath(sim: Sim, gridId: number, from: Tile, goal: PathGoal, opts: PathOpts = {}): Tile[] | null {
  const grid = sim.grids.get(gridId);
  if (!grid?.has('struct') || !grid.inBounds(from.x, from.y) || !grid.inBounds(goal.x, goal.y)) return null;
  const { width, height } = grid;
  const struct = grid.raw('struct');
  const mods = grid.has('module') ? grid.raw('module') : null;
  const infos = new Map<number, WalkInfo>();
  const o2 = opts.avoidThin && grid.has('o2') ? grid.raw('o2') : null;
  const walk = (i: number): boolean => {
    const kind = struct[i] as number;
    if (!isWalkable(kind) && !(opts.suited && isEvaWalkable(grid, i % width, Math.floor(i / width)))) return false;
    if (o2 && (o2[i] as number) < EVA_THIN_AIR_BELOW && i !== fromIndex) return false;
    const m = mods ? (mods[i] as number) : 0;
    if (m === 0) return true;
    let info = infos.get(m);
    if (!info) infos.set(m, (info = walkInfo(sim, m)));
    return !info.solid || info.open.has(Math.floor(i / width) * OPEN_KEY + (i % width));
  };
  const fromIndex = from.y * width + from.x;
  const adj = goal.adjacent ? 1 : 0;
  const isGoal = (x: number, y: number): boolean =>
    adj ? Math.max(Math.abs(x - goal.x), Math.abs(y - goal.y)) === 1 : x === goal.x && y === goal.y;
  if (!adj && !walk(goal.y * width + goal.x)) return null;
  if (isGoal(from.x, from.y)) return [];

  const heuristic = (x: number, y: number): number => {
    const dx = Math.max(0, Math.abs(x - goal.x) - adj);
    const dy = Math.max(0, Math.abs(y - goal.y) - adj);
    return DIAG * Math.min(dx, dy) + ORTHO * Math.abs(dx - dy);
  };

  const g = new Int32Array(width * height).fill(-1);
  const parent = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heap = new MinHeap();
  const start = from.y * width + from.x;
  g[start] = 0;
  heap.push(heuristic(from.x, from.y), heuristic(from.x, from.y), start);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    if (isGoal(cx, cy)) {
      const out: Tile[] = [];
      for (let i = cur; i !== start; i = parent[i] as number) out.push({ x: i % width, y: Math.floor(i / width) });
      return out.reverse();
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closed[ni] || !walk(ni)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!walk(cy * width + nx) || !walk(ny * width + cx))) continue;
      const ng = (g[cur] as number) + (diagonal ? DIAG : ORTHO);
      if (g[ni] !== -1 && ng >= (g[ni] as number)) continue;
      g[ni] = ng;
      parent[ni] = cur;
      const h = heuristic(nx, ny);
      heap.push(ng + h, h, ni);
    }
  }
  return null;
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
