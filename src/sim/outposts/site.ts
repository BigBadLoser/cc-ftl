/**
 * Fitting a generated station onto an asteroid (outposts/gen.ts): the dock airlock, the dug carve and the placement search.
 * Pure helpers over a station `ShipTemplate` and an `AsteroidPlan`.
 */
import type { AsteroidPlan } from '../asteroids/types';
import { airlockTiles } from '../modules/airlock';
import { footprintTiles, hullOutward, hullSide } from '../modules/footprint';
import type { ModuleDef, ShipTemplate } from '../registry';
import { Struct } from '../structure';

/** The airlock that opens to space on the asteroid: its outer door, the collar tile beyond it, and the side it faces (-1 north, 1 south). */
export interface Dock {
  outer: { x: number; y: number };
  collar: { x: number; y: number };
  dir: -1 | 1;
}

/** The north- or south-facing airlock closest to the template's top or bottom edge with nothing built in the three columns beyond it, or null. */
export function pickDock(t: ShipTemplate, defs: Record<string, ModuleDef>): Dock | null {
  const h = t.rows.length;
  let best: Dock | null = null;
  let bestEdge = Infinity;
  for (const m of t.modules ?? []) {
    const def = defs[m.def];
    const side = def?.airlock ? hullSide(def, m.rot) : null;
    if (!def || (side !== 'n' && side !== 's')) continue;
    const outer = airlockTiles(def, m).outer;
    const out = hullOutward(side);
    const edge = side === 'n' ? outer.y : h - 1 - outer.y;
    const dir: -1 | 1 = side === 'n' ? -1 : 1;
    let clear = true;
    for (let y = outer.y + dir; y >= 0 && y < h; y += dir) for (let x = outer.x - 1; x <= outer.x + 1; x++) clear &&= (t.rows[y]?.[x] ?? '.') === '.';
    if (!clear) continue;
    if (edge < bestEdge) [best, bestEdge] = [{ outer, collar: { x: outer.x + out.x, y: outer.y + out.y }, dir }, edge];
  }
  return best;
}

/**
 * A dug station: the rock is its hull. Hull fill that borders outside and touches no room becomes '.' (the asteroid's rock mass
 * fills it); every wall beside a room stays (a finished rock wall once stamped), so rooms are carved into rock and every wall,
 * partition or face, is one tile of dressed rock. Module footprints and airlock tiles are kept. Cargo
 * frames and containers hanging outside the hull are dropped.
 */
export function carveInRock(src: ShipTemplate, defs: Record<string, ModuleDef>): ShipTemplate {
  // Outside cargo frames and the crates on them have no place in rock: the cargo rooms inside stay.
  const t: ShipTemplate = { ...src, rows: src.rows.map((r) => r.replace(/=/g, '.')), modules: (src.modules ?? []).filter((m) => !defs[m.def]?.container) };
  const keep = new Set<string>();
  for (const m of t.modules ?? []) {
    const def = defs[m.def];
    if (!def) continue;
    for (const p of footprintTiles(def, m.x, m.y, m.rot)) keep.add(`${p.x},${p.y}`);
    if (def.airlock) {
      const a = airlockTiles(def, m);
      for (const p of [a.outer, a.inner, a.inside, ...(a.collar ? [a.collar] : [])]) keep.add(`${p.x},${p.y}`);
    }
  }
  const at = (x: number, y: number): string => t.rows[y]?.[x] ?? '.';
  // A wall that touches the inside (any neighbour, diagonals too) stays: it is the room's face, dressed rock once stamped, so
  // no raw rock pokes up where two wall runs meet. Only hull fill with no inside beside it goes back to rock mass.
  const ring = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
  const inside = (x: number, y: number): boolean => ring.some(([dx, dy]) => { const c = at(x + dx, y + dy); return c !== '#' && c !== '.'; });
  const rows = t.rows.map((row, y) => Array.from(row, (c, x) => (
    c === '#' && !keep.has(`${x},${y}`) && !inside(x, y) && ring.slice(0, 4).some(([dx, dy]) => at(x + dx, y + dy) === '.') ? '.' : c)).join(''));
  return { ...t, rows };
}

/** Template tiles (the non-'.' ones) as a lookup, with the template size. */
export function builtOf(t: ShipTemplate): { w: number; h: number; has: (x: number, y: number) => boolean; count: number } {
  const w = Math.max(...t.rows.map((r) => r.length));
  let count = 0;
  for (const r of t.rows) for (const c of r) if (c !== '.') count++;
  return { w, h: t.rows.length, has: (x, y) => (t.rows[y]?.[x] ?? '.') !== '.', count };
}

/**
 * Where the template's top-left goes in the plan so the dock's outer door is the asteroid's rock face (the first body row under
 * its three columns from the north, or the last from the south) with open space for the collar beyond. Among the columns that fit,
 * the one that leaves the fewest base tiles over empty space (they would be filled with ground or rock, bulging the outline),
 * then the most central. Null if none keeps that share at or below `maxBulge`.
 */
export function placeAt(plan: AsteroidPlan, t: ShipTemplate, dock: Dock, maxBulge: number): { x: number; y: number; face: number } | null {
  const b = builtOf(t);
  const space = (x: number, y: number): boolean => plan.struct[y * plan.w + x] === Struct.Space;
  let best: { x: number; y: number; face: number; bulge: number; off: number } | null = null;
  for (let x0 = 0; x0 + b.w <= plan.w; x0++) {
    const cols = [x0 + dock.outer.x - 1, x0 + dock.outer.x, x0 + dock.outer.x + 1];
    let face = dock.dir < 0 ? 0 : plan.h - 1;
    for (const cx of cols) {
      let y = dock.dir < 0 ? 0 : plan.h - 1;
      while (y >= 0 && y < plan.h && space(cx, y)) y -= dock.dir;
      if (y < 0 || y >= plan.h) { face = -1; break; }
      face = dock.dir < 0 ? Math.max(face, y) : Math.min(face, y);
    }
    if (face < 0 || (dock.dir < 0 ? face < 1 : face > plan.h - 2)) continue;
    const y0 = face - dock.outer.y;
    if (y0 < 0 || y0 + b.h > plan.h) continue;
    let bulge = 0;
    for (let ly = 0; ly < b.h; ly++) for (let lx = 0; lx < b.w; lx++) if (b.has(lx, ly) && space(x0 + lx, y0 + ly)) bulge++;
    const off = Math.abs(x0 + b.w / 2 - plan.w / 2);
    if (!best || bulge < best.bulge || (bulge === best.bulge && off < best.off)) best = { x: x0, y: y0, face, bulge, off };
  }
  return best && best.bulge <= maxBulge * b.count ? { x: best.x, y: best.y, face: best.face } : null;
}

/** The tile just outside an airlock module (its docking collar, else past the outer door), in template tiles. */
export function airlockOutside(def: ModuleDef, m: { x: number; y: number; rot: number }): { x: number; y: number } {
  const a = airlockTiles(def, m);
  if (a.collar) return a.collar;
  const out = hullOutward(hullSide(def, m.rot) ?? 'n');
  return { x: a.outer.x + out.x, y: a.outer.y + out.y };
}

/**
 * Drop the airlocks other than the dock that would open into rock. A dug base keeps only its dock (every other airlock would
 * open into rock mass); a surface outpost keeps those whose outside tile (`outsideRock` false) is open ground or space. A dropped
 * airlock's outer door tile becomes plain wall ('#', a finished rock wall in a dug base) and its inner door tile floor, so the
 * bay stays an airtight room with a one-tile wall on the hull line.
 */
export function dropBuriedAirlocks(
  t: ShipTemplate, defs: Record<string, ModuleDef>, dock: Dock, keep: (outside: { x: number; y: number }) => boolean,
): ShipTemplate {
  const rows = t.rows.map((r) => r.split(''));
  const put = (p: { x: number; y: number }, c: string) => { if (rows[p.y] && rows[p.y]![p.x] !== undefined) rows[p.y]![p.x] = c; };
  const modules = (t.modules ?? []).filter((m) => {
    const def = defs[m.def];
    if (!def?.airlock) return true;
    const a = airlockTiles(def, m);
    if (a.outer.x === dock.outer.x && a.outer.y === dock.outer.y) return true;
    if (keep(airlockOutside(def, m))) return true;
    put(a.outer, '#');
    put(a.inner, '_');
    return false;
  });
  return { ...t, rows: rows.map((r) => r.join('')), modules };
}
