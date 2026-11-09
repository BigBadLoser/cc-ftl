import { passAt, type WalkInfo } from '../modules/walk';
import type { Sim } from '../sim';
import { shipGrid } from '../regions';
import { snapshot, thinMask } from '../gridSnapshot';
import { walkSignature, type PathOpts, type Tile } from './pathfind';

/** Fewest moves to a tile (-1: no walk reaches it). */
export type Hops = (x: number, y: number) => number;

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1],
];

/** The last field per sector grid instance, with what it was built from. Derived data, never saved. */
const LAST = new WeakMap<object, { key: string; sig: string; hops: Hops }>();

/**
 * The fewest moves from `from` to every tile of the ship's grid, over the walk `findPath` searches (the same walk rule and options, 8 directions,
 * no corner cutting), costs ignored. Any path findPath returns to a tile is a walk of this graph, so it is at least this many steps long, and a
 * tile at -1 has no path at all: a bound to skip goals that cannot beat a better one, without searching them. Null where findPath finds nothing
 * (no grid, or `from` outside it). The last field is kept while the grid's walk signature (pathfind.ts) and the request are unchanged.
 */
export function hopField(sim: Sim, shipId: number, from: Tile, opts: PathOpts = {}): Hops | null {
  const grid = shipGrid(sim, shipId);
  if (!grid?.has('struct') || !grid.inBounds(from.x, from.y)) return null;
  const key = `${shipId}|${from.x},${from.y}|${opts.avoidThin ? 1 : 0}${opts.suited ? 1 : 0}${opts.fly ? 1 : 0}`;
  const sig = walkSignature(sim, grid, !!opts.avoidThin);
  const last = LAST.get(sim.sector.grid);
  if (last && last.key === key && last.sig === sig) return last.hops;

  const { width, height, x0, y0 } = grid;
  const struct = snapshot(grid, 'struct');
  const mods = grid.has('module') ? snapshot(grid, 'module') : null;
  const jam = grid.has('jam') ? snapshot(grid, 'jam') : null;
  const thin = opts.avoidThin && grid.has('o2') ? thinMask(grid).thin : null;
  const infos = new Map<number, WalkInfo>();
  const start = (from.y - y0) * width + (from.x - x0);
  const known = new Uint8Array(width * height); // 0 not asked, 1 walkable, 2 not
  const walk = (i: number): boolean => {
    let k = known[i] as number;
    if (k === 0) {
      const ok = !(thin && thin[i] && i !== start) &&
        passAt(sim, grid, x0 + (i % width), y0 + Math.floor(i / width), struct[i] as number, jam?.[i], mods?.[i], infos, !!opts.suited, !!opts.fly);
      known[i] = k = ok ? 1 : 2;
    }
    return k === 1;
  };
  const dist = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++] as number;
    const cx = cur % width, cy = (cur - cx) / width;
    const d = (dist[cur] as number) + 1;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ni = ny * width + nx;
      if (dist[ni] !== -1 || !walk(ni)) continue;
      if (dx !== 0 && dy !== 0 && (!walk(cy * width + nx) || !walk(ny * width + cx))) continue;
      dist[ni] = d;
      queue[tail++] = ni;
    }
  }
  const hops: Hops = (x, y) => (grid.inBounds(x, y) ? (dist[(y - y0) * width + (x - x0)] as number) : -1);
  LAST.set(sim.sector.grid, { key, sig, hops });
  return hops;
}

/** The fewest moves to any tile beside (x, y) (findPath's `adjacent` goal of one tile), -1 when none is reached. */
export function hopsBeside(hops: Hops, x: number, y: number): number {
  let best = -1;
  for (const [dx, dy] of NEIGHBOURS) {
    const d = hops(x + dx, y + dy);
    if (d >= 0 && (best < 0 || d < best)) best = d;
  }
  return best;
}
