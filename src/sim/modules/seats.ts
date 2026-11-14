import type { Tile } from '../crew/pathfind';
import type { ModuleDef } from '../registry';
import { rotatedSize } from './footprint';

/**
 * Seats (`ModuleDef.seats`: the bench): where seat i of a placed module is, the one owner of that answer (the renderer and the
 * render lab place sitters with it). Nothing sends crew to sit on a seat yet.
 */

/** Seats of a module in seat points: the sub-tile world position (tile centres are whole numbers) of each. */
export function seatPoints(def: ModuleDef, m: { x: number; y: number; rot: number }): { x: number; y: number }[] {
  const [w, d] = rotatedSize(def, m.rot);
  const cx = m.x + (w - 1) / 2, cy = m.y + (d - 1) / 2;
  return (def.seats?.at ?? []).map(([u, v]) => {
    // Local (u, v) to a grid offset by quarter turns, as rotateOffset turns tiles: r0 (u, v), r1 (-v, u), r2 (-u, -v), r3 (v, -u).
    const [dx, dy] = ([[u, v], [-v, u], [-u, -v], [v, -u]] as const)[m.rot % 4] as readonly [number, number];
    return { x: cx + dx, y: cy + dy };
  });
}

/** The footprint tile a seat belongs to (the one crew walk to): the tile its point rounds to, the larger one for a point on the edge between two. */
export function seatTile(def: ModuleDef, m: { x: number; y: number; rot: number }, i: number): Tile {
  const p = seatPoints(def, m)[i] as { x: number; y: number };
  const [w, d] = rotatedSize(def, m.rot);
  return { x: Math.min(m.x + w - 1, Math.max(m.x, Math.round(p.x))), y: Math.min(m.y + d - 1, Math.max(m.y, Math.round(p.y))) };
}
