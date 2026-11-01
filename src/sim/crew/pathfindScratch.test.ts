import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { Sim } from '../sim';
import { OPEN_KEY, walkInfo, type WalkInfo } from '../modules/walk';
import { EVA_THIN_AIR_BELOW } from '../tuning';
import { DoorJam, Struct, isEvaWalkable, isWalkable } from '../structure';
import { shipGrid } from '../regions';
import { EXTERIOR_COST, findPath, type PathGoal, type PathOpts, type Tile } from './pathfind';

// The pre-scratch-reuse implementation, copied verbatim (allocating three grid-sized arrays per call), as the reference.
const ORTHO = 10;
const DIAG = 14;
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1],
];
void EXTERIOR_COST;

/**
 * A* on one grid. 8 directions, no corner cutting. Returns the steps after `from` (empty if
 * already at the goal) or null if unreachable. Ties break on f, then h, then tile index.
 * Takes shipId so portal-spanning paths can extend this later.
 */
export function legacyFindPath(sim: Sim, shipId: number, from: Tile, goal: PathGoal, opts: PathOpts = {}): Tile[] | null {
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

  const g = new Int32Array(width * height).fill(-1);
  const parent = new Int32Array(width * height).fill(-1);
  const closed = new Uint8Array(width * height);
  const heap = new LegacyMinHeap();
  const start = fromIndex;
  let doorEnd = -1;
  const pathTo = (end: number): Tile[] => {
    const out: Tile[] = [];
    for (let i = end; i !== start; i = parent[i] as number) out.push({ x: x0 + (i % width), y: y0 + Math.floor(i / width) });
    return out.reverse();
  };
  g[start] = 0;
  heap.push(heuristic(from.x, from.y), heuristic(from.x, from.y), start);

  while (heap.size > 0) {
    const cur = heap.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    if (isGoal(x0 + cx, y0 + cy)) {
      // Same rule as findPath (#248): a doorway beside an adjacency goal is only a fallback stop.
      if (adj && struct[cur] === Struct.Door && cur !== start) {
        if (doorEnd < 0) doorEnd = cur;
      } else return pathTo(cur);
    }
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (closed[ni] || !walk(ni)) continue;
      const diagonal = dx !== 0 && dy !== 0;
      if (diagonal && (!walk(cy * width + nx) || !walk(ny * width + cx))) continue;
      const step = (diagonal ? DIAG : ORTHO) * (isWalkable(struct[ni] as number) ? 1 : EXTERIOR_COST);
      const ng = (g[cur] as number) + step;
      if (g[ni] !== -1 && ng >= (g[ni] as number)) continue;
      g[ni] = ng;
      parent[ni] = cur;
      const h = heuristic(x0 + nx, y0 + ny);
      heap.push(ng + h, h, ni);
    }
  }
  return doorEnd >= 0 ? pathTo(doorEnd) : null;
}

/** Binary min-heap of (f, h, index) ordered lexicographically. */
class LegacyMinHeap {
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

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function randomRows(rand: () => number, w: number, h: number): string[] {
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let r = '';
    for (let x = 0; x < w; x++) {
      const v = rand();
      r += v < 0.22 ? '#' : v < 0.27 ? 'D' : '_';
    }
    rows.push(r);
  }
  return rows;
}

describe('findPath scratch reuse', () => {
  it('returns exactly the paths of the allocating implementation, over many random pairs and interleaved grid sizes', () => {
    const rand = lcg(12345);
    const sims = [[9, 7], [20, 14], [9, 7], [31, 5], [20, 14]].map(([w, h]) => {
      const s = new Sim(1);
      stampShip(s, { name: 't', rows: randomRows(rand, w as number, h as number) }, { faction: 'player', state: 'prize', x: 0, y: 0 });
      return { s, w: w as number, h: h as number };
    });
    let found = 0;
    let nulls = 0;
    for (let n = 0; n < 4000; n++) {
      const { s, w, h } = sims[Math.floor(rand() * sims.length)] as { s: Sim; w: number; h: number };
      const from = { x: Math.floor(rand() * w), y: Math.floor(rand() * h) };
      const goal: PathGoal = { x: Math.floor(rand() * w), y: Math.floor(rand() * h) };
      if (rand() < 0.3) {
        goal.adjacent = true;
        if (rand() < 0.5) {
          goal.w = 1 + Math.floor(rand() * 2);
          goal.h = 1 + Math.floor(rand() * 2);
        }
      }
      const opts: PathOpts = { avoidThin: rand() < 0.3, suited: rand() < 0.3 };
      const sid = 1;
      const a = legacyFindPath(s, sid, from, goal, opts);
      const b = findPath(s, sid, from, goal, opts);
      expect(b).toEqual(a);
      if (a) found++;
      else nulls++;
    }
    expect(found).toBeGreaterThan(500);
    expect(nulls).toBeGreaterThan(500);
  });
});
