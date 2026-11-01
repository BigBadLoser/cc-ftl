import { walkSignature, type PathGoal, type PathOpts, type Tile } from '../crew/pathfind';
import { OPEN_KEY, walkInfo, type WalkInfo } from '../modules/walk';
import { shipGrid } from '../regions';
import type { ShipGrid } from '../shipGrid';
import type { Sim } from '../sim';
import { DoorJam, Struct, isEvaWalkable, isWalkable } from '../structure';
import { EVA_THIN_AIR_BELOW } from '../tuning';

/**
 * Navigation views for the scheduler (docs/CREW_AI.md 7.2): one ship's window under one set of walker conditions (`findPath`'s `PathOpts`), as
 * flat arrays. `pass` is `findPath`'s walk predicate per tile, `mult` the step cost class (1 deck, 4 exterior), `label` a 4-connected component
 * labelling (the corner rule makes `findPath`'s 8-connectivity reduce to 4), so an unreachable job costs a label compare instead of a search.
 * Views are cached on `findPath`'s own walk signature, so they are derived data only: never saved, rebuilt when what the walk reads changes.
 */
export interface View {
  x0: number;
  y0: number;
  w: number;
  h: number;
  pass: Uint8Array;
  /** 1 where the tile is blocked only by thin air: the start tile is exempt from that (as in `findPath`). */
  thinOnly: Uint8Array;
  mult: Uint8Array;
  /** 1 on Door tiles: beside an `adjacent` goal a doorway is only a fallback stop, as in `findPath` (#248). */
  door: Uint8Array;
  label: Int32Array;
  /** FNV hash of `pass` (the scheduler's pass gate compares it). */
  hash: number;
}

export const ORTHO = 10;
export const DIAG = 14;
const EXTERIOR = 4;

/** Views per sector grid instance, keyed ship and conditions. A restored or new sector brings a new grid and starts empty. */
const VIEWS = new WeakMap<object, Map<string, { sig: string; view: View }>>();

/** The view of `ship` under `opts`, or null when the ship has no structure. */
export function viewOf(sim: Sim, ship: number, opts: PathOpts): View | null {
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct')) return null;
  const key = `${ship}|${opts.avoidThin ? 1 : 0}${opts.suited ? 1 : 0}`;
  const sig = walkSignature(sim, grid, !!opts.avoidThin);
  let views = VIEWS.get(sim.sector.grid);
  if (!views) VIEWS.set(sim.sector.grid, (views = new Map()));
  const hit = views.get(key);
  if (hit && hit.sig === sig) return hit.view;
  const { width: w, height: h, x0, y0 } = grid;
  const struct = grid.load('struct');
  const mods = grid.has('module') ? grid.load('module') : null;
  const jam = grid.has('jam') ? grid.load('jam') : null;
  const o2 = opts.avoidThin && grid.has('o2') ? grid.load('o2') : null;
  const infos = new Map<number, WalkInfo>();
  const pass = new Uint8Array(w * h);
  const thinOnly = new Uint8Array(w * h);
  const mult = new Uint8Array(w * h);
  const door = new Uint8Array(w * h);
  let hash = 0x811c9dc5;
  for (let i = 0; i < w * h; i++) {
    const kind = struct[i] as number;
    const x = x0 + (i % w), y = y0 + Math.floor(i / w);
    mult[i] = isWalkable(kind) ? 1 : EXTERIOR;
    door[i] = kind === Struct.Door ? 1 : 0;
    pass[i] = walkable(sim, grid, kind, x, y, jam?.[i], mods?.[i], infos, opts) ? 1 : 0;
    if (pass[i] && o2 && (o2[i] as number) < EVA_THIN_AIR_BELOW) {
      pass[i] = 0;
      thinOnly[i] = 1;
    }
    hash = Math.imul(hash ^ (pass[i] as number), 0x01000193);
  }
  const view: View = { x0, y0, w, h, pass, thinOnly, mult, door, label: labels(pass, w, h), hash: hash >>> 0 };
  views.set(key, { sig, view });
  return view;
}

/** `findPath`'s walk predicate, thin air aside. */
function walkable(sim: Sim, grid: ShipGrid, kind: number, x: number, y: number, jam: number | undefined, mod: number | undefined, infos: Map<number, WalkInfo>, opts: PathOpts): boolean {
  if (!isWalkable(kind) && !(opts.suited && isEvaWalkable(grid, x, y))) return false;
  if (jam === DoorJam.Shut) return false;
  if (!mod) return true;
  let info = infos.get(mod);
  if (!info) infos.set(mod, (info = walkInfo(sim, mod)));
  return !info.solid || info.open.has(y * OPEN_KEY + x);
}

function labels(pass: Uint8Array, w: number, h: number): Int32Array {
  const label = new Int32Array(w * h);
  const stack: number[] = [];
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (!pass[s] || label[s]) continue;
    label[s] = ++next;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop() as number;
      const cx = c % w;
      for (const n of [cx > 0 ? c - 1 : -1, cx < w - 1 ? c + 1 : -1, c - w, c + w]) {
        if (n < 0 || n >= w * h || !pass[n] || label[n]) continue;
        label[n] = next;
        stack.push(n);
      }
    }
  }
  return label;
}

export const inView = (v: View, x: number, y: number): boolean => x >= v.x0 && y >= v.y0 && x < v.x0 + v.w && y < v.y0 + v.h;
export const indexOf = (v: View, x: number, y: number): number => (y - v.y0) * v.w + (x - v.x0);

/** Components a walker on `from` can reach: its own when it is passable, else those of its passable 4-neighbours. */
export function startLabels(v: View, from: Tile): number[] {
  if (!inView(v, from.x, from.y)) return [];
  const i = indexOf(v, from.x, from.y);
  if (v.pass[i]) return [v.label[i] as number];
  const out: number[] = [];
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
    const x = from.x + dx, y = from.y + dy;
    if (!inView(v, x, y)) continue;
    const l = v.label[indexOf(v, x, y)] as number;
    if (l && !out.includes(l)) out.push(l);
  }
  return out;
}

const gapOf = (goal: PathGoal, x: number, y: number): number =>
  Math.max(goal.x - x, x - (goal.x + (goal.w ?? 1) - 1), goal.y - y, y - (goal.y + (goal.h ?? 1) - 1), 0);

/** `findPath`'s goal test: the tile itself, or with `adjacent` the ring beside the goal box. */
export const isGoalTile = (goal: PathGoal, x: number, y: number): boolean => (goal.adjacent ? gapOf(goal, x, y) === 1 : x === goal.x && y === goal.y);

/** True when a goal tile is only a fallback stop: a doorway beside an `adjacent` goal (`findPath` takes it only if no other stop is reachable). */
export const isFallbackStop = (v: View, goal: PathGoal, i: number): boolean => !!goal.adjacent && v.door[i] === 1;

/** Window indices of the passable goal tiles of `goal`. */
export function goalTiles(v: View, goal: PathGoal): number[] {
  const out: number[] = [];
  if (!goal.adjacent) {
    if (inView(v, goal.x, goal.y) && v.pass[indexOf(v, goal.x, goal.y)]) out.push(indexOf(v, goal.x, goal.y));
    return out;
  }
  for (let y = goal.y - 1; y <= goal.y + (goal.h ?? 1); y++) {
    for (let x = goal.x - 1; x <= goal.x + (goal.w ?? 1); x++) {
      if (gapOf(goal, x, y) === 1 && inView(v, x, y) && v.pass[indexOf(v, x, y)]) out.push(indexOf(v, x, y));
    }
  }
  return out;
}

/** True exactly when `findPath` from `from` to `goal` under this view's conditions finds a path. `starts` is `startLabels(v, from)`. */
export function reaches(v: View, from: Tile, starts: number[], goal: PathGoal): boolean {
  if (!inView(v, from.x, from.y) || !inView(v, goal.x, goal.y)) return false;
  if (!goal.adjacent && !v.pass[indexOf(v, goal.x, goal.y)] && !(goal.x === from.x && goal.y === from.y)) return false;
  if (isGoalTile(goal, from.x, from.y)) return true;
  for (const t of goalTiles(v, goal)) if (starts.includes(v.label[t] as number)) return true;
  return false;
}

/** Admissible octile bound on the path cost (x10) from `from` to the goal: `findPath`'s heuristic. */
export function octileBound(from: Tile, goal: PathGoal): number {
  const adj = goal.adjacent ? 1 : 0;
  const dx = Math.max(0, Math.max(goal.x - from.x, from.x - (goal.x + (goal.w ?? 1) - 1)) - adj);
  const dy = Math.max(0, Math.max(goal.y - from.y, from.y - (goal.y + (goal.h ?? 1) - 1)) - adj);
  return DIAG * Math.min(dx, dy) + ORTHO * Math.abs(dx - dy);
}
