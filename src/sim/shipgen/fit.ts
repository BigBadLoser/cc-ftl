import type { Rng } from '../rng';
import { footprintTiles, rotatedSize } from '../modules/footprint';
import type { ModuleDef } from '../registry';
import type { Layout, PlacedModule } from './layout';
import type { RoomRole } from './types';
import { SLEEP } from './useTiles';

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
      if ((!def.solid && !def.airlock && !SLEEP.has(defId)) || opts.sealed || lay.connected()) return c.pm;
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
 * The lamps the generator places: a walk-over floor light in ordinary rooms, a cage lamp in working rooms, and light
 * masts on big open floors (their long reach is what keeps a hall from being dotted with lamps). Each is planned with a
 * reach inside its module's light radius (floor light 7, cage lamp 10, mast 15).
 */
export const LAMP = 'module.light';
export const CAGE = 'module.light_cage';
export const MAST = 'module.light_mast';
const REACH: Record<string, number> = { [LAMP]: 4.5, [CAGE]: 7, [MAST]: 11 };
/** Rooms lit by cage lamps instead of floor lights. */
const WORKING: readonly RoomRole[] = ['engine', 'reactor', 'cargo', 'industry'];

/** True for any of the generator's lamps. */
export const isLamp = (def: string): boolean => def in REACH;
/** The reach a lamp is planned with (0 for anything else). */
export const reachOf = (def: string): number => REACH[def] ?? 0;

/**
 * Push a lamp, or report that it does not fit. A solid lamp is taken back if it cut any floor off (the same guard the
 * vignettes use), so a cage lamp or mast never seals a nook.
 */
function tryLamp(lay: Layout, def: string, i: number, room: number): boolean {
  const x = i % lay.w, y = Math.floor(i / lay.w);
  if (lay.occ[i] !== -1 || lay.fitError(def, x, y, 0, room)) return false;
  const base = lay.defs[def]?.solid ? lay.unreached() : -1;
  lay.push({ def, x, y, rot: 0 });
  if (base >= 0 && lay.unreached() > base) { lay.pop(); return false; }
  return true;
}

/** Lights until every floor tile of the room is within reach of one, preferring wall-side tiles. */
export function lightRoom(lay: Layout, rng: Rng, room: number): void {
  const tiles = lay.roomTiles(room);
  if (tiles.length >= BIG_ROOM) { lightOpen(lay, room, tiles); return; }
  const lamp = WORKING.includes(lay.roles[room] as RoomRole) ? CAGE : LAMP;
  const lit = new Uint8Array(lay.cells.length);
  const covers = (a: number, b: number, r: number): boolean =>
    Math.hypot((a % lay.w) - (b % lay.w), Math.floor(a / lay.w) - Math.floor(b / lay.w)) <= r;
  for (const m of lay.modules) {
    if (!isLamp(m.def)) continue;
    const li = m.y * lay.w + m.x;
    if (lay.roomOf[li] === room) for (const t of tiles) if (covers(li, t, reachOf(m.def))) lit[t] = 1;
  }
  for (let guard = 0; guard < 12; guard++) {
    const dark = tiles.filter((t) => !lit[t]);
    if (dark.length === 0) return;
    // Candidates best first; a cage lamp that would cut floor off falls back to a floor light on the same tile.
    const scored: { c: number; score: number }[] = [];
    for (const c of tiles) {
      if (lay.occ[c] !== -1 || lay.fitError(LAMP, c % lay.w, Math.floor(c / lay.w), 0, room)) continue;
      const wallSide = lay.neighbours(c).some((n) => lay.cells[n] === '#') ? 1.5 : 0;
      scored.push({ c, score: dark.filter((d) => covers(c, d, reachOf(lamp))).length + wallSide + rng.next() });
    }
    if (scored.length === 0) return;
    scored.sort((p, q) => q.score - p.score);
    let put = -1;
    let def = lamp;
    for (const { c } of scored.slice(0, 8)) if (tryLamp(lay, lamp, c, room)) { put = c; break; }
    if (put < 0) { def = LAMP; put = (scored[0] as { c: number }).c; lay.push({ def, x: put % lay.w, y: Math.floor(put / lay.w), rot: 0 }); }
    for (const t of tiles) if (covers(put, t, reachOf(def))) lit[t] = 1;
  }
}

/** Rooms this big (courtyards: plazas, gardens, drill halls; hangar decks) are lit by `lightOpen`, with no lamp cap. */
export const BIG_ROOM = 120;
/** Lamp grid pitch in big rooms (alternate rows shifted half a pitch): masts, or floor lights in corridors. */
const GRID = 15;
const HALL_GRID = 9;
/** The reach every floor tile of a big room is kept within: a mast's, or a floor light's (corridors, and the nooks
 * masts miss). */
export const OPEN_REACH = REACH[MAST] as number;
const NOOK_REACH = 6;

/**
 * Big open rooms: light masts on a staggered grid scaled to the area (one near every grid point, so the count grows
 * with the room), then floor lights for any tile still dark (furniture took the grid tile, a nook by the wall) from the
 * nearest free tile. A corridor network keeps its walkways clear: floor lights on a tighter grid, no masts. Every step
 * is local, so it stays cheap on courts of a thousand tiles and more.
 */
function lightOpen(lay: Layout, room: number, tiles: number[]): void {
  const W = lay.w;
  const lit = new Uint8Array(lay.cells.length);
  const mark = (li: number, reach: number): void => {
    const R = Math.ceil(reach);
    const lx = li % W, ly = (li - lx) / W;
    for (let y = Math.max(0, ly - R); y <= Math.min(lay.h - 1, ly + R); y++) {
      for (let x = Math.max(0, lx - R); x <= Math.min(W - 1, lx + R); x++) {
        if ((x - lx) ** 2 + (y - ly) ** 2 <= reach * reach && lay.roomOf[y * W + x] === room) lit[y * W + x] = 1;
      }
    }
  };
  for (const m of lay.modules) if (isLamp(m.def) && lay.roomOf[m.y * W + m.x] === room) mark(m.y * W + m.x, reachOf(m.def));
  const fits = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < lay.h && lay.roomOf[y * W + x] === room
    && lay.cells[y * W + x] === '_' && lay.occ[y * W + x] === -1 && !lay.fitError(LAMP, x, y, 0, room);
  /** Free tiles round (x, y) within `r`, nearest first (rings outward). */
  const near = (x: number, y: number, r: number): number[] => {
    const out: number[] = [];
    for (let d = 0; d <= r; d++) {
      const ring: [number, number][] = [];
      for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === d && fits(x + dx, y + dy)) ring.push([dx * dx + dy * dy, (y + dy) * W + x + dx]);
      }
      ring.sort((p, q) => p[0] - q[0]);
      for (const [, i] of ring) out.push(i);
    }
    return out;
  };
  let x0 = W, y0 = lay.h, x1 = 0, y1 = 0;
  for (const t of tiles) { const x = t % W, y = (t - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  // The grid, centred on the room's box so the margins match.
  const hall = lay.roles[room] === 'hall';
  const [lamp, grid, reach] = hall ? [LAMP, HALL_GRID, NOOK_REACH] : [MAST, GRID, reachOf(MAST)];
  const ox = x0 + (((x1 - x0) % grid) >> 1), oy = y0 + (((y1 - y0) % grid) >> 1);
  for (let gy = oy; gy <= y1; gy += grid) {
    const shift = ((gy - oy) / grid) % 2 === 1 ? grid >> 1 : 0;
    for (let gx = ox + shift; gx <= x1; gx += grid) {
      if (lit[gy * W + gx] && lay.roomOf[gy * W + gx] === room) continue;
      for (const i of near(gx, gy, 3).slice(0, 6)) if (!lit[i] && tryLamp(lay, lamp, i, room)) { mark(i, reach); break; }
    }
  }
  for (const t of tiles) {
    if (lit[t]) continue;
    const i = near(t % W, Math.floor(t / W), NOOK_REACH - 1)[0];
    if (i !== undefined) { lay.push({ def: LAMP, x: i % W, y: Math.floor(i / W), rot: 0 }); mark(i, NOOK_REACH); }
  }
}
