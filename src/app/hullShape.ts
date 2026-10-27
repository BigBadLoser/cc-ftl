import type { Tile } from './input';

/**
 * Geometry of the hull shape tool: a rectangle whose corners can each be cut by a 45 degree chamfer. Pure functions on tile
 * lists, so a later freehand outline tool (vertices snapped to 0/45/90 degrees) can reuse the preview and validation, which only
 * ever see the resulting tile set.
 */

/** A rectangle of tiles, inclusive on both ends, x0 <= x1 and y0 <= y1. */
export interface ShapeRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se'];
/** Chamfer size per corner: tiles cut along each of the two edges (0 = square corner). */
export type Chamfers = Record<Corner, number>;
export const NO_CHAMFER: Chamfers = { nw: 0, ne: 0, sw: 0, se: 0 };

export const rectOf = (a: Tile, b: Tile): ShapeRect => ({ x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) });

/** Direction from a corner towards the inside of the rectangle, per axis. */
const inward = (c: Corner): Tile => ({ x: c === 'nw' || c === 'sw' ? 1 : -1, y: c === 'nw' || c === 'ne' ? 1 : -1 });

export function cornerTile(r: ShapeRect, c: Corner): Tile {
  return { x: c === 'nw' || c === 'sw' ? r.x0 : r.x1, y: c === 'nw' || c === 'ne' ? r.y0 : r.y1 };
}

/**
 * The step sizes a chamfer takes: 0, 2, 3, ... A 1-step cut is skipped because the hull art turns a staircase into a diagonal only from 2
 * steps; a lone cut corner tile reads as a broken corner.
 */
export function snapChamfer(raw: number, rect: ShapeRect): number {
  const cap = Math.max(0, Math.min(rect.x1 - rect.x0, rect.y1 - rect.y0));
  const n = raw < 1 ? 0 : Math.max(2, Math.round(raw));
  return n > cap ? (cap >= 2 ? cap : 0) : n;
}

/** The chamfer size a handle dragged to `t` asks for: how far in along the corner's diagonal the pointer is. */
export function chamferFromDrag(r: ShapeRect, c: Corner, t: Tile): number {
  const k = cornerTile(r, c);
  const d = inward(c);
  return snapChamfer(((t.x - k.x) * d.x + (t.y - k.y) * d.y) / 2, r);
}

/** The tiles of the rectangle with its corners cut: tile (dx, dy) from a corner goes when dx + dy < that corner's chamfer. */
export function shapeTiles(r: ShapeRect, ch: Chamfers): Tile[] {
  const out: Tile[] = [];
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const cut = CORNERS.some((c) => {
        const k = cornerTile(r, c);
        return Math.abs(x - k.x) + Math.abs(y - k.y) < ch[c];
      });
      if (!cut) out.push({ x, y });
    }
  }
  return out;
}

/**
 * The tiles a corner's handle covers: the 2x2 block that sticks out past the rectangle's corner. Fixed at the rectangle's corner
 * however deep the chamfer is, and a whole 2x2 so a finger can land on it.
 */
export function handleTiles(r: ShapeRect, c: Corner): Tile[] {
  const k = cornerTile(r, c);
  const o = inward(c);
  return [{ x: k.x, y: k.y }, { x: k.x - o.x, y: k.y }, { x: k.x, y: k.y - o.y }, { x: k.x - o.x, y: k.y - o.y }];
}

/** The corner whose handle covers the tile, or null. */
export function handleAt(r: ShapeRect, t: Tile): Corner | null {
  return CORNERS.find((c) => handleTiles(r, c).some((h) => h.x === t.x && h.y === t.y)) ?? null;
}
