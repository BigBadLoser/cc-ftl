/**
 * A star fort's corner battery (assembly/fort.ts `batteries`): a pointed room, mirrored across the corner's diagonal,
 * its door(s) onto the hall at the inner end. Guns step along the diagonal from the point inward, each centred on it,
 * a tile apart (roof-mounted guns need a clear tile between them); guns the diagonal cannot hold stand in pairs either
 * side of it, mirrored (the same gun both sides where there are two), spread out toward the sides with a walkway kept
 * along the walls. No batteries: power storage lives in the battery room. The room must pass `roomProblems`. Prototype (#460): the user steers it from the room sample.
 */
import type { Tile } from '../../../modules/footprint';
import type { Layout } from '../../layout';
import { roomProblems, type Piece } from './check';

export function furnishBastion(lay: Layout, room: number, need: readonly string[], entries: readonly Tile[]): number[] | null {
  const floor = (x: number, y: number): boolean => lay.inBounds(x, y) && lay.at(x, y) === '_' && lay.roomOf[y * lay.w + x] === room;
  const tiles = lay.roomTiles(room).map((i) => ({ x: i % lay.w, y: Math.floor(i / lay.w) }));
  if (tiles.length === 0 || entries.length === 0) return null;
  const D = { x: entries.reduce((t, e) => t + e.x, 0) / entries.length, y: entries.reduce((t, e) => t + e.y, 0) / entries.length };
  const far = (t: Tile): number => Math.hypot(t.x - D.x, t.y - D.y);
  const P = tiles.reduce((a, b) => (far(b) > far(a) ? b : a));
  const v = { x: Math.sign(P.x - D.x) || 1, y: Math.sign(P.y - D.y) || 1 };
  const mirror = (t: Tile): Tile => { const rx = t.x - P.x, ry = t.y - P.y, k = v.x * v.y; return { x: P.x + ry * k, y: P.y + rx * k }; };
  const size = (id: string): number => lay.defs[id]?.footprint[0] ?? 2;
  const nearDoor = (x: number, y: number, s: number): boolean => entries.some((e) => e.x >= x - 2 && e.x <= x + s + 1 && e.y >= y - 2 && e.y <= y + s + 1);
  /** An s x s square with its corner nearest the point at c (it reaches back toward the door). */
  const square = (id: string, c: Tile): Piece => { const s = size(id); return { def: id, x: v.x > 0 ? c.x - s + 1 : c.x, y: v.y > 0 ? c.y - s + 1 : c.y, rot: 0 }; };
  const start = lay.modules.length;
  const undo = (): null => { while (lay.modules.length > start) lay.pop(); return null; };
  const fits = (p: Piece): boolean => lay.fitError(p.def, p.x, p.y, p.rot, room) === null && !nearDoor(p.x, p.y, size(p.def));
  const guns = need.filter((m) => lay.defs[m]?.weapon || lay.defs[m]?.pointDefense).sort((a, b) => size(b) - size(a));
  const reach = Math.ceil(Math.max(Math.abs(P.x - D.x), Math.abs(P.y - D.y)));
  // Down the diagonal from the point: each gun at the first spot that takes it, the next a clear tile on.
  const left: string[] = [];
  let t = 0;
  for (const g of guns) {
    let placed = false;
    for (; t <= reach && !placed; t++) {
      const p = square(g, { x: P.x - v.x * t, y: P.y - v.y * t });
      if (!fits(p)) continue;
      lay.push(p);
      placed = true;
      t += size(g);
    }
    if (!placed) left.push(g);
  }
  // Tiles from the nearest wall (1: against it), counted over the room's floor.
  const dist = new Map<number, number>(), key = (x: number, y: number): number => y * lay.w + x;
  let ring = tiles.filter((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !floor(t.x + (dx as number), t.y + (dy as number))));
  for (let d = 1; ring.length > 0; d++) {
    for (const t of ring) dist.set(key(t.x, t.y), d);
    ring = ring.flatMap((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: t.x + (dx as number), y: t.y + (dy as number) })))
      .filter((t, i, all) => floor(t.x, t.y) && !dist.has(key(t.x, t.y)) && all.findIndex((u) => u.x === t.x && u.y === t.y) === i);
  }
  const clearOfWalls = (p: Piece): boolean => { const s = size(p.def); for (let y = p.y; y < p.y + s; y++) for (let x = p.x; x < p.x + s; x++) if ((dist.get(key(x, y)) ?? 0) < 2) return false; return true; };
  // Either side of the diagonal, in mirrored pairs (the same gun both sides where two are left), from the point inward.
  const mirrored = (p: Piece): Piece => {
    const s = size(p.def), a = mirror({ x: p.x, y: p.y }), b = mirror({ x: p.x + s - 1, y: p.y + s - 1 });
    return { def: p.def, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), rot: 0 };
  };
  while (left.length > 0) {
    const g = left.shift() as string, twin = left.indexOf(g);
    let done = false;
    // Out toward the sides, a walkway off the walls, the farthest spot first; where
    // none is that clear, the nearest the diagonal that fits.
    for (const strict of [true, false]) for (let a = 0; a <= reach && !done; a++) for (let o = strict ? reach : 2; strict ? o >= 2 : o <= reach; o += strict ? -1 : 1) {
      if (done) break;
      const p = square(g, { x: P.x - v.x * a + v.x * o, y: P.y - v.y * a - v.y * o }), q = mirrored(p);
      if (!fits(p) || (strict && (!clearOfWalls(p) || !clearOfWalls(q) || !fits(q)))) continue;
      lay.push(p);
      if (twin >= 0 && fits(q)) { lay.push(q); left.splice(twin, 1); }
      done = true;
    }
    if (!done) return undo();
  }
  const works = (): boolean => roomProblems(floor, entries, lay.modules.slice(start), lay.defs).length === 0;
  return works() ? lay.modules.slice(start).map((_, i) => start + i) : undo();
}
