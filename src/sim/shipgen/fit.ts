import type { Rng } from '../rng';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Layout, PlacedModule } from './layout';

/** Rotations the generator uses per module: the ones the hand-made templates use (and the art covers). */
export function rotsOf(defId: string, def: ModuleDef): number[] {
  if (def.engine) return [1]; // engines on the camera-facing stern (+x) hull
  if (def.airlock) return [0, 2, 3];
  if (defId === 'module.bed') return [1, 3, 0];
  if (defId === 'module.lifeSupport') return [0, 1, 3];
  if (defId === 'module.mess_table' || defId === 'module.med_bed' || defId === 'module.hydroponics') return [0, 1];
  if (def.console || def.galley || def.storage || def.access || defId === 'module.chair') return [0, 1, 2, 3];
  return [0];
}

/** How snugly a footprint hugs walls (tiles of its rim that touch a wall or another room), plus a little noise. */
function hugScore(lay: Layout, def: ModuleDef, x: number, y: number, rot: number, room: number): number {
  const [w, h] = rotatedSize(def, rot);
  let s = 0;
  for (const t of footprintTiles(def, x, y, rot)) {
    const rim = [[t.x - 1, t.y], [t.x + 1, t.y], [t.x, t.y - 1], [t.x, t.y + 1]] as const;
    for (const [nx, ny] of rim) {
      if (nx >= x && ny >= y && nx < x + w && ny < y + h) continue;
      const c = lay.at(nx, ny);
      const i = ny * lay.w + nx;
      if (c === '#' || c === '.' || (lay.inBounds(nx, ny) && lay.roomOf[i] !== room)) s += c === 'D' ? -3 : 1;
      else if (lay.inBounds(nx, ny) && lay.occ[i] !== -1) s += 0.5;
    }
  }
  return s;
}

/**
 * Place one module in one of `rooms` (tried in order), at the snuggest position that keeps the ship connected.
 * Returns the placement or null.
 */
export function placeOne(
  lay: Layout, rng: Rng, defId: string, rooms: readonly number[], opts: { rots?: number[]; spread?: boolean; sealed?: boolean } = {},
): PlacedModule | null {
  const def = lay.defs[defId];
  if (!def) return null;
  const rots = opts.rots ?? rotsOf(defId, def);
  for (const room of rooms) {
    const tiles = lay.roomTiles(room);
    if (tiles.length === 0) continue;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const i of tiles) {
      const x = i % lay.w; const y = Math.floor(i / lay.w);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const cands: { pm: PlacedModule; score: number }[] = [];
    for (const rot of rots) {
      const [w, h] = rotatedSize(def, rot);
      for (let y = y0 - h; y <= y1 + 1; y++) {
        for (let x = x0 - w; x <= x1 + 1; x++) {
          if (lay.fitError(defId, x, y, rot, room)) continue;
          let score = hugScore(lay, def, x, y, rot, room) + rng.next() * 1.5;
          if (opts.spread) score += distToModules(lay, x + w / 2, y + h / 2) * 0.6;
          cands.push({ pm: { def: defId, x, y, rot }, score });
        }
      }
    }
    cands.sort((a, b) => b.score - a.score);
    for (const c of cands.slice(0, 40)) {
      lay.push(c.pm);
      if ((!def.solid && !def.airlock) || opts.sealed || lay.connected()) return c.pm;
      lay.pop();
    }
  }
  return null;
}

/** Distance from a point to the nearest placed module's centre (capped), to spread repeats out. */
function distToModules(lay: Layout, cx: number, cy: number): number {
  let best = 6;
  for (const m of lay.modules) {
    const d = lay.defs[m.def] as ModuleDef;
    const [w, h] = rotatedSize(d, m.rot);
    best = Math.min(best, Math.hypot(m.x + w / 2 - cx, m.y + h / 2 - cy));
  }
  return best;
}

/**
 * Light radius the generator plans with, in small rooms and open ones alike: every floor tile within this of a lamp
 * (inside the floor grate's radius of 7).
 */
const LIGHT_REACH = 6;
/**
 * The grate's own radius: a few corner tiles past LIGHT_REACH but within this of a lamp are left as they are (dimmer),
 * rather than each taking a lamp beside one already there.
 */
const LAMP_EDGE = 7;
/** A lamp's spot: of the tiles that light at least this share of what the best one lights, the most central. */
const NEARLY = 0.75;

/**
 * How central each tile of a room is: the shortest straight run from it to the room's edge, along a row or a column
 * (1 on a tile against the wall; a corridor's centre line, or a room's middle, the most). Furniture does not count as an
 * edge: a lamp is a grate in the deck, the plan of the room is what it is centred in.
 */
function depthOf(lay: Layout, room: number, tiles: readonly number[]): Map<number, number> {
  const W = lay.w, inRoom = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < lay.h && lay.roomOf[y * W + x] === room;
  const out = new Map<number, number>();
  for (const t of tiles) {
    const x = t % W, y = (t - x) / W;
    let d = Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      let k = 1;
      while (k < d && inRoom(x + k * dx, y + k * dy)) k++;
      d = Math.min(d, k);
    }
    out.set(t, d);
  }
  return out;
}

/**
 * The room and the rooms its floor opens straight onto, with no wall between (a hall and the airlock bays off it): a
 * lamp in any of them lights this room's floor too.
 */
function openTo(lay: Layout, room: number, tiles: readonly number[]): Set<number> {
  const W = lay.w, out = new Set<number>([room]);
  for (const t of tiles) {
    const x = t % W, y = (t - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= lay.h || lay.cells[ny * W + nx] !== '_') continue;
      const r = lay.roomOf[ny * W + nx] as number;
      if (r >= 0) out.add(r);
    }
  }
  return out;
}

/**
 * One lamp, else a pair, that lights every tile of `dark` (the most central such: the pair whose lamps are most central
 * together). Placed with `put`; false when neither does, and the room is lit a lamp at a time. A greedy first lamp
 * takes the middle and leaves both ends wanting more than one more.
 */
function fewest(lay: Layout, room: number, dark: readonly number[], depth: Map<number, number>, covers: (a: number, b: number) => boolean, put: (c: number) => void): boolean {
  if (dark.length === 0) return true;
  const spots = lay.roomTiles(room).filter((c) => lay.occ[c] === -1 && !lay.fitError('module.light', c % lay.w, Math.floor(c / lay.w), 0, room));
  const sets = spots.map((c) => dark.map((d) => covers(c, d)));
  const n = sets.map((m) => m.filter(Boolean).length), D = dark.length, dep = (c: number): number => depth.get(c) ?? 0;
  let one = -1;
  for (let i = 0; i < spots.length; i++) if (n[i] === D && (one < 0 || dep(spots[i] as number) > dep(spots[one] as number))) one = i;
  if (one >= 0) { put(spots[one] as number); return true; }
  let pair: [number, number] | null = null, best = -1;
  for (let i = 0; i < spots.length; i++) {
    for (let j = i + 1; j < spots.length; j++) {
      if ((n[i] as number) + (n[j] as number) < D) continue;
      const a = sets[i] as boolean[], b = sets[j] as boolean[];
      let all = true;
      for (let k = 0; k < D && all; k++) all = (a[k] as boolean) || (b[k] as boolean);
      const score = dep(spots[i] as number) + dep(spots[j] as number);
      if (all && score > best) { best = score; pair = [i, j]; }
    }
  }
  if (!pair) return false;
  put(spots[pair[0]] as number);
  put(spots[pair[1]] as number);
  return true;
}

/**
 * Lights until every floor tile of the room is within reach of one (a lamp in a room open onto it counts). Floor lights stand centred where they can: of the
 * tiles that light something still dark, the most central ones (`depthOf`), then the one that lights the most.
 */
export function lightRoom(lay: Layout, rng: Rng, room: number): void {
  const tiles = lay.roomTiles(room);
  if (tiles.length >= BIG_ROOM) { lightOpen(lay, room, tiles); return; }
  const depth = depthOf(lay, room, tiles);
  const lit = new Uint8Array(lay.cells.length);
  const covers = (a: number, b: number): boolean =>
    Math.hypot((a % lay.w) - (b % lay.w), Math.floor(a / lay.w) - Math.floor(b / lay.w)) <= LIGHT_REACH;
  const open = openTo(lay, room, tiles);
  for (const m of lay.modules) {
    if (m.def !== 'module.light') continue;
    const li = m.y * lay.w + m.x;
    if (open.has(lay.roomOf[li] as number)) for (const t of tiles) if (covers(li, t)) lit[t] = 1;
  }
  const lamps: number[] = [];
  for (const m of lay.modules) if (m.def === 'module.light' && open.has(lay.roomOf[m.y * lay.w + m.x] as number)) lamps.push(m.y * lay.w + m.x);
  const edge = (t: number): boolean => lamps.some((l) => Math.hypot((l % lay.w) - (t % lay.w), Math.floor(l / lay.w) - Math.floor(t / lay.w)) <= LAMP_EDGE);
  const put = (c: number): void => {
    lay.push({ def: 'module.light', x: c % lay.w, y: Math.floor(c / lay.w), rot: 0 });
    lamps.push(c);
    for (const t of tiles) if (covers(c, t)) lit[t] = 1;
  };
  if (fewest(lay, room, tiles.filter((t) => !lit[t] && !edge(t)), depth, covers, put)) return;
  for (let guard = 0; guard < 12; guard++) {
    const dark = tiles.filter((t) => !lit[t]);
    if (dark.length === 0 || dark.every(edge)) return;
    // Coverage first, so each lamp lights as much of what is still dark as any (not the next central tile, which can
    // stand beside the last lamp and light a corner); of the tiles that light nearly as much, the most central.
    const scored: { c: number; lights: number }[] = [];
    for (const c of tiles) {
      if (lay.occ[c] !== -1 || lay.fitError('module.light', c % lay.w, Math.floor(c / lay.w), 0, room)) continue;
      const lights = dark.filter((d) => covers(c, d)).length;
      if (lights > 0) scored.push({ c, lights });
    }
    const most = Math.max(0, ...scored.map((s) => s.lights));
    let best = -1, bestScore = -1, bestDepth = 0;
    for (const { c, lights } of scored) {
      if (lights < NEARLY * most) continue;
      const dc = depth.get(c) ?? 0, score = lights + rng.next();
      if (dc > bestDepth || (dc === bestDepth && score > bestScore)) { bestDepth = dc; bestScore = score; best = c; }
    }
    if (best < 0) return;
    put(best);
  }
}

/** Rooms this big (courtyards: plazas, gardens, drill halls) are lit by `lightOpen`, with no lamp cap. */
export const BIG_ROOM = 120;
/** Lamp grid pitch in big rooms, and the reach every floor tile is kept within there (`LIGHT_REACH`). */
const GRID = 9;
export const OPEN_REACH = LIGHT_REACH;

/**
 * Big open rooms: a lamp grid scaled to the area (one lamp near every grid point, so the count grows with the room),
 * then a pass that lights any tile still dark (furniture took the grid tile, a nook by the wall) from the nearest free
 * tile. Every step is local, so it stays cheap on courts of a thousand tiles and more.
 */
function lightOpen(lay: Layout, room: number, tiles: number[]): void {
  const W = lay.w;
  const lit = new Uint8Array(lay.cells.length);
  const R = Math.ceil(OPEN_REACH);
  const mark = (li: number): void => {
    const lx = li % W, ly = (li - lx) / W;
    for (let y = Math.max(0, ly - R); y <= Math.min(lay.h - 1, ly + R); y++) {
      for (let x = Math.max(0, lx - R); x <= Math.min(W - 1, lx + R); x++) {
        if ((x - lx) ** 2 + (y - ly) ** 2 <= OPEN_REACH * OPEN_REACH && lay.roomOf[y * W + x] === room) lit[y * W + x] = 1;
      }
    }
  };
  const open = openTo(lay, room, tiles);
  for (const m of lay.modules) if (m.def === 'module.light' && open.has(lay.roomOf[m.y * W + m.x] as number)) mark(m.y * W + m.x);
  const fits = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < lay.h && lay.roomOf[y * W + x] === room
    && lay.cells[y * W + x] === '_' && lay.occ[y * W + x] === -1 && !lay.fitError('module.light', x, y, 0, room);
  const depth = depthOf(lay, room, tiles);
  /** The most central free tile within `r` of (x, y) (a circle, so it lights (x, y)) (`depthOf`), the nearest of those; -1 when none is free. */
  const near = (x: number, y: number, r: number): number => {
    let best = -1, bd = Infinity, bdep = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r || !fits(x + dx, y + dy)) continue;
      const i = (y + dy) * W + x + dx, dep = Math.min(depth.get(i) ?? 0, r + 1), e = dx * dx + dy * dy;
      if (dep > bdep || (dep === bdep && e < bd)) { bdep = dep; bd = e; best = i; }
    }
    return best;
  };
  const put = (i: number): void => { lay.push({ def: 'module.light', x: i % W, y: Math.floor(i / W), rot: 0 }); mark(i); };
  let x0 = W, y0 = lay.h, x1 = 0, y1 = 0;
  for (const t of tiles) { const x = t % W, y = (t - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // The grid, centred on the room's box so the margins match.
  const ox = x0 + (((x1 - x0) % GRID) >> 1), oy = y0 + (((y1 - y0) % GRID) >> 1);
  for (let gy = oy; gy <= y1; gy += GRID) {
    for (let gx = ox; gx <= x1; gx += GRID) {
      if (lit[gy * W + gx] && lay.roomOf[gy * W + gx] === room) continue;
      const i = near(gx, gy, 2);
      if (i >= 0 && !lit[i]) put(i);
    }
  }
  // What is still dark: a lamp within reach of each dark tile, the one that lights the most of what is dark (not the
  // most central, which for every corner of a hall is the same few middle tiles, so lamps would stand in pairs); of
  // those that light nearly as much, the most central, then the nearest.
  const darkNear = (x: number, y: number): number => {
    let n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const i = (y + dy) * W + x + dx;
      if (dx * dx + dy * dy <= OPEN_REACH * OPEN_REACH && y + dy >= 0 && y + dy < lay.h && x + dx >= 0 && x + dx < W && lay.roomOf[i] === room && !lit[i]) n++;
    }
    return n;
  };
  for (const t of tiles) {
    if (lit[t]) continue;
    const tx = t % W, ty = Math.floor(t / W), r = R - 1;
    const cands: { i: number; n: number; dep: number; e: number }[] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r || !fits(tx + dx, ty + dy)) continue;
      const i = (ty + dy) * W + tx + dx;
      cands.push({ i, n: darkNear(tx + dx, ty + dy), dep: Math.min(depth.get(i) ?? 0, r + 1), e: dx * dx + dy * dy });
    }
    const most = Math.max(0, ...cands.map((c) => c.n));
    const best = cands.filter((c) => c.n >= NEARLY * most).sort((a, b) => b.dep - a.dep || a.e - b.e)[0];
    if (best) put(best.i);
  }
}
