import { ShipC } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import { iso, type Pt } from './iso';

/**
 * Render-side sector offsets (ARCHITECTURE "Sector grid" §7 step 5). Entity positions are still grid-local until the
 * coordinate flip (step 6); the renderer draws everything in one sector frame (art origin = sector tile (0, 0)) by adding
 * the region's origin, its ShipC top-left. After step 6 the origin is (0, 0) for every grid and these become identities.
 */
export interface Origin {
  x: number;
  y: number;
}

const ZERO: Origin = { x: 0, y: 0 };

/** Sector top-left (tiles) of a grid's region; (0, 0) for a grid with no ShipC (test fixtures). */
export function regionOrigin(world: World, gridId: number): Origin {
  for (const id of world.query(ShipC)) {
    const s = world.get(id, ShipC);
    if (s?.gridId === gridId) return s;
  }
  return ZERO;
}

/** Art px (sector frame) of a grid-local tile position (fractional; integers are tile centres). */
export function sectorPos(world: World, gridId: number, x: number, y: number): Pt {
  const o = regionOrigin(world, gridId);
  return iso(o.x + x, o.y + y);
}

/** Art px (sector frame) of a sector position in tiles, where a tile's centre is at +0.5 (bodies, projectiles, the camera). */
export const sectorArt = (sx: number, sy: number): Pt => iso(sx - 0.5, sy - 0.5);
