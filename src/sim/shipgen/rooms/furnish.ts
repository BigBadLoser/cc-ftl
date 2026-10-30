import type { Rng } from '../../rng';
import { accessTile, footprintTiles, rotatedSize } from '../../modules/footprint';
import type { ModuleDef } from '../../registry';
import type { Layout, PlacedModule } from '../layout';
import { pickWeighted } from '../plan';
import type { Arrangement, Dir, RoomRecipe, Step, Wall } from './types';
import { withCompanions } from './companions';
import { planCourt } from './courts';
import { placeVignettes } from './vignettes';

/** One room's draw from its recipe: the arrangement, the mirror and the module chosen for each step. */
export interface RoomDraw {
  recipe: RoomRecipe;
  arr: Arrangement;
  mirror: boolean;
  picks: string[];
  /** The arrangement's plan laid the room out (rooms/plans.ts): its steps are skipped. */
  planned?: boolean;
  /** The planned modules the plan placed (their jobs are done). */
  plannedDefs?: Set<string>;
}

export function drawRoom(rng: Rng, recipe: RoomRecipe): RoomDraw {
  const arr = pickWeighted(rng, recipe.arrangements.map((a) => ({ value: a, weight: a.weight })));
  const mirror = rng.chance(0.5);
  const picks = arr.steps.map((s) => (typeof s.mod === 'string' ? s.mod : (s.mod[rng.int(0, s.mod.length - 1)] as string)));
  return { recipe, arr, mirror, picks };
}

/** Index of the draw's 'spec' step for a planned module, or -1. */
export const specStep = (d: RoomDraw, defId: string): number => d.arr.steps.findIndex((s, i) => s.count === 'spec' && d.picks[i] === defId);

/** Compass index (the rotation that makes a module's user look that way): port 0, aft 1, stbd 2, fore 3. */
const COMPASS: Record<Dir, number> = { port: 0, aft: 1, stbd: 2, fore: 3 };
const flip = (d: Dir, mirror: boolean): Dir => (mirror && d === 'port' ? 'stbd' : mirror && d === 'stbd' ? 'port' : d);

interface Box { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number }

function boxOf(lay: Layout, tiles: number[]): Box {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const i of tiles) {
    const x = i % lay.w; const y = Math.floor(i / lay.w);
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 };
}

/** Share (0..1) of a footprint side whose outside tiles are not this room's floor (wall, other room). */
function sideBlocked(lay: Layout, room: number, x: number, y: number, w: number, h: number, d: Dir): number {
  const run: [number, number][] = [];
  if (d === 'port') for (let i = 0; i < w; i++) run.push([x + i, y - 1]);
  if (d === 'stbd') for (let i = 0; i < w; i++) run.push([x + i, y + h]);
  if (d === 'fore') for (let j = 0; j < h; j++) run.push([x - 1, y + j]);
  if (d === 'aft') for (let j = 0; j < h; j++) run.push([x + w, y + j]);
  let n = 0;
  for (const [tx, ty] of run) {
    const c = lay.at(tx, ty);
    if (c === 'D') return -1;
    if (c !== '_' || lay.roomOf[ty * lay.w + tx] !== room) n++;
  }
  return n / run.length;
}

/** The direction (compass index) from a point toward a target point, by the dominant axis. */
const toward = (fx: number, fy: number, tx: number, ty: number): number =>
  Math.abs(tx - fx) >= Math.abs(ty - fy) ? (tx >= fx ? 1 : 3) : ty >= fy ? 2 : 0;

const centreOf = (def: ModuleDef, m: PlacedModule): [number, number] => {
  const [w, h] = rotatedSize(def, m.rot);
  return [m.x + w / 2, m.y + h / 2];
};

/** Modules (with their indices) whose anchor lies in this room. */
function roomModules(lay: Layout, room: number): PlacedModule[] {
  return lay.modules.filter((m) => lay.roomOf[m.y * lay.w + m.x] === room);
}

function wallScore(lay: Layout, room: number, b: Box, x: number, y: number, w: number, h: number, wall: Wall, mirror: boolean): number {
  const side = (d: Dir): number => sideBlocked(lay, room, x, y, w, h, flip(d, mirror));
  const longX = b.x1 - b.x0 >= b.y1 - b.y0;
  if (wall === 'any') return Math.max(side('port'), side('stbd'), side('fore'), side('aft'));
  if (wall === 'long') return longX ? Math.max(side('port'), side('stbd')) : Math.max(side('fore'), side('aft'));
  if (wall === 'end') return longX ? Math.max(side('fore'), side('aft')) : Math.max(side('port'), side('stbd'));
  return side(wall);
}

/** Rim tiles of a footprint that touch another module (lights left out). */
function touching(lay: Layout, x: number, y: number, w: number, h: number): number {
  let n = 0;
  const hit = (i: number, j: number): void => {
    if (!lay.inBounds(i, j)) return;
    const o = lay.occ[j * lay.w + i] as number;
    if (o >= 0 && lay.modules[o]?.def !== 'module.light') n++;
  };
  for (let i = x; i < x + w; i++) { hit(i, y - 1); hit(i, y + h); }
  for (let j = y; j < y + h; j++) { hit(x - 1, j); hit(x + w, j); }
  return n / (2 * (w + h));
}

/** Score one candidate placement for a step (higher is better). */
function score(lay: Layout, rng: Rng, room: number, b: Box, d: RoomDraw, s: Step, id: string, x: number, y: number, rot: number): number {
  const def = lay.defs[id] as ModuleDef;
  const [w, h] = rotatedSize(def, rot);
  const cx = x + w / 2; const cy = y + h / 2;
  let v = rng.next() * 0.6;
  // A little general wall hugging, and doors stay unblocked.
  const sides = (['port', 'stbd', 'fore', 'aft'] as const).map((k) => sideBlocked(lay, room, x, y, w, h, k));
  if (sides.some((k) => k < 0)) v -= 6;
  v += 0.4 * sides.reduce((t, k) => t + Math.max(0, k), 0);
  if (s.wall) v += 5 * wallScore(lay, room, b, x, y, w, h, s.wall, d.mirror);
  if (s.wall2) v += 3 * wallScore(lay, room, b, x, y, w, h, s.wall2, d.mirror);
  if (s.toward) {
    const t = flip(s.toward, d.mirror);
    const span = Math.max(1, t === 'fore' || t === 'aft' ? b.x1 - b.x0 : b.y1 - b.y0);
    const off = t === 'fore' ? x - b.x0 : t === 'aft' ? b.x1 - (x + w - 1) : t === 'port' ? y - b.y0 : b.y1 - (y + h - 1);
    v -= 4 * off / span;
  }
  if (s.pack) {
    v += 1.2 * sides.reduce((t, k) => t + Math.max(0, k), 0) + 0.8 * touching(lay, x, y, w, h);
    // Opened from the walkway, not from floor that could hold the next crate.
    const a = accessTile(def, x, y, rot);
    if (a && lay.inBounds(a.x, a.y)) v += lay.keep[a.y * lay.w + a.x] ? 4 : 0;
  }
  if (s.face === 'in' && accessTile(def, x, y, rot)) v += toward(cx, cy, b.cx, b.cy) === rot ? 3 : 0;
  if (s.centre) {
    if (s.centre !== 'y') v -= 1.2 * Math.abs(cx - b.cx);
    if (s.centre !== 'x') v -= 1.2 * Math.abs(cy - b.cy);
  }
  const mods = roomModules(lay, room);
  if (s.faceTo) {
    const t = mods.filter((m) => m.def === s.faceTo);
    if (t.length > 0) {
      const near = t.map((m) => centreOf(lay.defs[m.def] as ModuleDef, m)).sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy))[0] as [number, number];
      v += toward(cx, cy, near[0], near[1]) === rot ? 4 : 0;
    }
  }
  if (s.near || s.clear) {
    const tiles = footprintTiles(def, x, y, rot);
    let touch = false;
    let crowd = 0;
    const r = s.clear ?? 1;
    for (let j = y - r; j < y + h + r; j++) {
      for (let i = x - r; i < x + w + r; i++) {
        if (!lay.inBounds(i, j) || tiles.some((t) => t.x === i && t.y === j)) continue;
        const o = lay.occ[j * lay.w + i] as number;
        if (o < 0) continue;
        const od = lay.modules[o] as PlacedModule;
        if (od.def === 'module.light') continue;
        crowd++;
        const adj = i >= x - 1 && i <= x + w && j >= y - 1 && j <= y + h && (i === x - 1 || i === x + w) !== (j === y - 1 || j === y + h);
        if (adj && od.def === s.near) touch = true;
      }
    }
    if (touch) v += 3;
    if (s.clear) v -= 1.5 * crowd;
  }
  if (s.row) {
    for (const m of mods) {
      if (m.def !== id) continue;
      const [mw, mh] = rotatedSize(lay.defs[m.def] as ModuleDef, m.rot);
      if (m.y === y && m.rot === rot) v += Math.abs(m.x - x) <= mw + 1 ? 2.5 : 1;
      else if (m.x === x && m.rot === rot) v += Math.abs(m.y - y) <= mh + 1 ? 2.5 : 1;
    }
  }
  return v;
}

/** Rotations a step may use, after its facing rule. */
function rotsFor(s: Step, d: RoomDraw, base: readonly number[]): readonly number[] {
  const rots = s.rots ?? base;
  if (!s.face || s.face === 'in') return rots;
  const want = COMPASS[flip(s.face, d.mirror)];
  const keep = rots.filter((r) => r === want);
  return keep.length > 0 ? keep : rots;
}

/** Place one module of step `si` in `room` at its best-scoring spot that keeps the ship connected. */
export function placeStep(lay: Layout, rng: Rng, room: number, d: RoomDraw, si: number, baseRots: readonly number[]): PlacedModule | null {
  const s = d.arr.steps[si] as Step;
  const id = d.picks[si] as string;
  const def = lay.defs[id];
  if (!def) return null;
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0) return null;
  const b = boxOf(lay, tiles);
  const cands: { pm: PlacedModule; v: number }[] = [];
  const first = s.grid ? roomModules(lay, room).find((m) => m.def === id) : undefined;
  const onGrid = (x: number, y: number): boolean => !first || !s.grid
    || (((x - first.x) % s.grid[0]) + s.grid[0]) % s.grid[0] === 0 && (((y - first.y) % s.grid[1]) + s.grid[1]) % s.grid[1] === 0;
  for (const rot of rotsFor(s, d, baseRots)) {
    const [w, h] = rotatedSize(def, rot);
    for (let y = b.y0 - h; y <= b.y1 + 1; y++) {
      for (let x = b.x0 - w; x <= b.x1 + 1; x++) {
        if (!onGrid(x, y) || (first && first.rot !== rot) || lay.fitError(id, x, y, rot, room)) continue;
        // Extras and fill keep to their wall: furniture does not float in the walkway.
        if (s.count !== 'spec' && s.wall && wallScore(lay, room, b, x, y, w, h, s.wall, d.mirror) < 0.5) continue;
        cands.push({ pm: { def: id, x, y, rot }, v: score(lay, rng, room, b, d, s, id, x, y, rot) });
      }
    }
  }
  cands.sort((p, q) => q.v - p.v);
  const base = lay.unreached();
  for (const c of cands.slice(0, 30)) {
    lay.push(c.pm);
    if (lay.unreached() <= base) return c.pm;
    lay.pop();
  }
  return null;
}

/** Share of the room's floor under modules (lights excluded). */
export function roomFill(lay: Layout, room: number): number {
  const tiles = lay.roomTiles(room);
  let used = 0;
  for (const i of tiles) {
    const o = lay.occ[i] as number;
    if (o >= 0 && lay.modules[o]?.def !== 'module.light') used++;
  }
  return used / Math.max(1, tiles.length);
}

/** Holds up to this many floor tiles take a straight walkway from their door. */
const SMALL_HOLD = 16;

/**
 * Reserve the draw's walkway (see Arrangement.walkway) as protected tiles: a spine through the middle of the room
 * along one axis, plus the shortest floor path from it to each door and each already protected tile.
 */
export function reserveWalkway(lay: Layout, room: number, d: RoomDraw): void {
  if (!d.arr.walkway) return;
  const tiles = lay.roomTiles(room);
  if (tiles.length === 0) return;
  const b = boxOf(lay, tiles);
  const inRoom = new Set(tiles);
  const longX = b.x1 - b.x0 >= b.y1 - b.y0;
  const alongX = d.arr.walkway === 'long' ? longX : !longX;
  // The spine: the middle row (or column), nudged toward the mirror side on even depths.
  const mid = alongX ? Math.floor((b.y0 + b.y1 + (d.mirror ? 1 : 0)) / 2) : Math.floor((b.x0 + b.x1 + (d.mirror ? 1 : 0)) / 2);
  let path = new Set<number>(tiles.filter((i) => (alongX ? Math.floor(i / lay.w) : i % lay.w) === mid));
  // A small hold (a container pod) packs tighter with its walkway running straight in from the door instead.
  const doorIn = tiles.map((i) => ({ i, n: lay.neighbours(i).find((n) => lay.cells[n] === 'D') })).find((t) => t.n !== undefined);
  if (tiles.length <= SMALL_HOLD && doorIn) {
    const step = doorIn.i - (doorIn.n as number);
    const line = new Set<number>();
    for (let c = doorIn.i; inRoom.has(c); c += step) line.add(c);
    path = line;
  }
  if (path.size === 0) return;
  const goals: number[] = [];
  for (const i of tiles) {
    if (lay.keep[i]) goals.push(i);
    else if (lay.neighbours(i).some((n) => lay.cells[n] === 'D')) goals.push(i);
  }
  for (const g of goals) {
    if (path.has(g)) continue;
    // Breadth-first from the goal to the nearest path tile, through the room's free floor.
    const prev = new Map<number, number>([[g, -1]]);
    const queue = [g];
    let hit = -1;
    for (let q = 0; q < queue.length && hit < 0; q++) {
      const c = queue[q] as number;
      for (const n of lay.neighbours(c)) {
        if (prev.has(n) || !inRoom.has(n) || !lay.walkable(n)) continue;
        prev.set(n, c);
        if (path.has(n)) { hit = n; break; }
        queue.push(n);
      }
    }
    for (let c = hit; c >= 0; c = prev.get(c) ?? -1) path.add(c);
  }
  for (const i of path) if (lay.walkable(i)) lay.keep[i] = (lay.keep[i] as number) + 1;
}

/** Keep the tile two steps in from each door clear too, so a door opens onto a walkway, not a module's side. */
export function keepDoorApproach(lay: Layout, room: number): void {
  for (const i of lay.roomTiles(room)) {
    for (const n of lay.neighbours(i)) {
      if (lay.cells[n] !== 'D') continue;
      const j = i + (i - n);
      if (j >= 0 && j < lay.cells.length && lay.cells[j] === '_' && lay.roomOf[j] === room) lay.keep[j] = (lay.keep[j] as number) + 1;
    }
  }
}

/** Set companions (chairs) around a placed module, each turned to face it; long sides first, in rng order. */
function companions(lay: Layout, rng: Rng, room: number, host: PlacedModule, id: string, n: number): void {
  const def = lay.defs[host.def] as ModuleDef;
  const [w, h] = rotatedSize(def, host.rot);
  const spots: { x: number; y: number; rot: number; long: boolean }[] = [];
  for (let i = 0; i < w; i++) {
    spots.push({ x: host.x + i, y: host.y - 1, rot: 2, long: w >= h }, { x: host.x + i, y: host.y + h, rot: 0, long: w >= h });
  }
  for (let j = 0; j < h; j++) {
    spots.push({ x: host.x - 1, y: host.y + j, rot: 1, long: h > w }, { x: host.x + w, y: host.y + j, rot: 3, long: h > w });
  }
  const order = spots.map((p) => ({ p, k: (p.long ? 0 : 10) + rng.next() })).sort((a, b) => a.k - b.k).map((o) => o.p);
  let placed = 0;
  const base = lay.unreached();
  for (const p of order) {
    if (placed >= n) return;
    if (lay.fitError(id, p.x, p.y, p.rot, room)) continue;
    lay.push({ def: id, x: p.x, y: p.y, rot: p.rot });
    if (lay.unreached() > base) { lay.pop(); continue; }
    placed++;
  }
}

/** True if the step should be skipped in this room. */
function skip(lay: Layout, room: number, s: Step, id: string): boolean {
  if (s.minFloor && lay.roomTiles(room).length < s.minFloor) return true;
  if (s.unless && roomModules(lay, room).some((m) => m.def === s.unless)) return true;
  return !!s.once && lay.modules.some((m) => m.def === id);
}

/** Run the draw's extra and fill steps in order (the planned modules are already in). */
export function furnish(
  lay: Layout, rng: Rng, room: number, d: RoomDraw, rotsOf: (id: string) => readonly number[], power: { spare: number },
): void {
  if (d.planned) return; // laid out whole (rooms/plans.ts), door approaches kept then
  keepDoorApproach(lay, room);
  if (d.arr.court) planCourt(lay, rng, room, d.arr.court, power);
  else if (d.arr.vignettes) placeVignettes(lay, rng, room, d.arr.vignettes, power);
  d.arr.steps.forEach((s, si) => {
    if (s.count === 'spec') {
      // The planned modules are all in: set each one's flush companions (ore bins beside a refinery).
      const w = s.with;
      // In turns: one each first, so the first host cannot take the floor the next needs, then the rest.
      const hosts = w ? roomModules(lay, room).filter((m) => m.def === d.picks[si]) : [];
      if (w) for (const n of [1, w.n]) for (const host of hosts) withCompanions(lay, rng, room, host, { ...w, n });
      return;
    }
    const id = d.picks[si] as string;
    if (skip(lay, room, s, id)) return;
    const draw = Math.max(0, -(lay.defs[id]?.power ?? 0));
    const n = s.once ? 1 : s.count === 'fill' ? 40 : s.count;
    for (let k = 0; k < n; k++) {
      if (s.count === 'fill' && roomFill(lay, room) >= (s.upTo ?? d.recipe.fill)) return;
      if (s.per && roomModules(lay, room).filter((m) => m.def === id).length >= roomModules(lay, room).filter((m) => m.def === s.per).length) return;
      if (draw > 0 && draw > power.spare) return;
      const pm = placeStep(lay, rng, room, d, si, rotsOf(id));
      if (!pm) return;
      power.spare -= draw;
      if (s.with) companions(lay, rng, room, pm, s.with.mod, s.with.n);
    }
  });
}
