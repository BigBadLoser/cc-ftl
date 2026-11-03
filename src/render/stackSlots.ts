import { ART_SCALE, TILE_H, TILE_W } from './iso';
import { crateCount, STACK_CRATES } from '../sim/items/stacks';

/**
 * Unit stacks: an item whose art has a `.unit` sprite (one scrap crate, one cloth bale) is drawn as that many units on a
 * fixed slot grid instead of one `.s/.m/.l` sprite. Four units per level (back, right, left, front, 0.35 tile apart),
 * up to three levels. Pure layout: the view places the sprites. The art (tools/blender/sprites/items_salvage.py) sizes
 * every unit to this grid: a 0.28 x 0.38 tile footprint and a height of one level.
 */

/** Units (crates) in a full stack: the sim's crate rule (sim/items/stacks.ts), which loading also counts in. */
export const STACK_UNITS = STACK_CRATES;
/** Units per level. */
export const PER_LEVEL = 4;
/** Distance between neighbouring slots, in tiles. */
export const SLOT_STEP = 0.35;
/** Rise of one level, in art px (a unit is 0.22 tile tall: ~8.6 art px; the spare fraction is the seam between levels). */
export const LEVEL_ART_PX = 9;

const D = SLOT_STEP / 2;

/** Grid offset (tiles) from the tile centre of slot j of a level, in draw order: back, right, left, front. */
function slot(j: number): [number, number] {
  return [j % 2 === 1 ? D : -D, j >= 2 ? D : -D];
}

/** Units to draw for a stack: its crates (one per twelfth of a full stack, rounded up, at least one, at most 12). */
export const unitCount = crateCount;

/** World-px offset from the tile centre of unit i (0-based, draw order), snapped to whole art px so units stay crisp. */
export function slotOffset(i: number): { x: number; y: number } {
  const [gx, gy] = slot(i % PER_LEVEL);
  const level = Math.floor(i / PER_LEVEL);
  const snap = (v: number): number => Math.round(v / ART_SCALE) * ART_SCALE;
  return {
    x: snap(((gx - gy) * TILE_W) / 2),
    y: snap(((gx + gy) * TILE_H) / 2) - level * LEVEL_ART_PX * ART_SCALE,
  };
}
