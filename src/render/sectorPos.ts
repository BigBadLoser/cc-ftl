import type { GridLike } from '../sim/grid';
import { iso, type Pt } from './iso';

/**
 * Sector frame helpers (ARCHITECTURE "Sector grid"). Since step 6 every entity position is a sector tile and the art
 * origin is sector tile (0, 0), so a sector tile's art position is plain `iso(x, y)`. The one offset left is the region
 * decorator's: a region's tile art (floors, walls, roof livery, chunk views) is built in ship-local tiles, so it looks the
 * same wherever the ship is stamped, and its containers sit at the region's top-left. Entity views subtract it.
 */
export interface Origin {
  x: number;
  y: number;
}

/** Sector top-left (tiles) of a grid's region: where its ship-local tile art is placed. */
export function regionOrigin(grid: Pick<GridLike, 'x0' | 'y0'>): Origin {
  return { x: grid.x0, y: grid.y0 };
}

/** Art px (sector frame) of a sector position in tiles, where a tile's centre is at +0.5 (bodies, projectiles, the camera). */
export const sectorArt = (sx: number, sy: number): Pt => iso(sx - 0.5, sy - 0.5);
