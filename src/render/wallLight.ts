import { Struct } from '../sim/structure';
import type { RegionTiles } from './regionTiles';

/** How far (tiles) a wall looks for a floor to take its light from. */
export const WALL_LIGHT_REACH = 6;

/**
 * The light level (0..255) a wall or roof tile is shaded by: the brightest `light` within the reach of the nearest ring
 * that holds a floor, so inside a thick block (no floor round it) the search widens until it reaches one and the block's
 * top is lit as one mass instead of darkening into a pit. The one owner of this answer: the hull (gridView) and the roof
 * (roofView) both read it, so they always match, lit or unlit. `read` overrides the light lookup (a caller's fast path).
 */
export function wallLight(tiles: RegionTiles, x: number, y: number, read: (x: number, y: number) => number = (nx, ny) => tiles.get('light', nx, ny)): number {
  let best = 0;
  for (let rr = 1; rr <= WALL_LIGHT_REACH; rr++) {
    let open = false;
    for (let dy = -rr; dy <= rr; dy++)
      for (let dx = -rr; dx <= rr; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) === rr && tiles.inside(nx, ny) && tiles.kindAt(nx, ny) === Struct.Floor) open = true;
        if (tiles.inside(nx, ny)) best = Math.max(best, read(nx, ny));
      }
    if (open) break;
  }
  return best;
}
