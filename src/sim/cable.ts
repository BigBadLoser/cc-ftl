import type { GridLike } from './grid';
import type { ShipTemplate } from './registry';
import { Struct } from './structure';

/**
 * Ground power cable (#514): a tile layer over levelled rock ground (`Struct.Ground`), in the `cable` grid field, that wires a module
 * standing out on the ground (an asteroid base's gun and point-defence turrets) to the base's hull. Crew walk over it. A cabled tile
 * belongs to the base (the `ship` owner layer), so what stands on it is the base's and draws its power: the base is still one power
 * network (modules/network.ts). Cables are permanent for now (no cutting, no repair) and only the base generator lays them.
 *
 * This module is the one owner of the question "is this tile cabled" and of the template's cable rows.
 */

/** Template `cable` rows: this character marks a cabled tile (anything else is none). */
export const CABLE_CHAR = '+';

/** True if a power cable runs over the tile: the `cable` layer set on rock ground. */
export function isCabled(grid: GridLike, x: number, y: number): boolean {
  return grid.has('cable') && grid.inBounds(x, y) && grid.get('struct', x, y) === Struct.Ground && grid.get('cable', x, y) !== 0;
}

/** Lay a cable over the tile; only rock ground takes one. True when the tile is cabled afterwards. */
export function layCable(grid: GridLike, x: number, y: number): boolean {
  if (!grid.has('cable') || !grid.inBounds(x, y) || grid.get('struct', x, y) !== Struct.Ground) return false;
  if (grid.get('cable', x, y) === 0) grid.set('cable', x, y, 1);
  return true;
}

/** The template's cabled tiles (local coordinates), row by row. */
export function templateCable(t: Pick<ShipTemplate, 'cable'>): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  (t.cable ?? []).forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === CABLE_CHAR) out.push({ x, y }); });
  return out;
}

/** Template cable rows (`w` x `h`) marking the tiles of `cabled` (row-major indices over a `w`-wide layout). */
export function cableRows(w: number, h: number, cabled: ReadonlySet<number>): string[] {
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (cabled.has(y * w + x) ? CABLE_CHAR : '.')).join(''));
}
