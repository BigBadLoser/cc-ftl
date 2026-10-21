import { ART_SCALE, TILE_W } from './iso';
/**
 * Heights of the art, the ONE place the renderer keeps them. They mirror the Blender pipeline (tools/blender/sprites/
 * walls.py: HF and HF + ROOF_T; core.ZPX), which also writes them to the manifest (`heights`); heights.test.ts checks
 * that the two agree, so a change to the walls means rebuilding the sprites and updating these numbers together.
 *
 * Real roof-mounted art (turrets, dishes, the AI mast) is modelled on the roof plane and anchored at floor level, so it
 * needs no lift: ROOF_H only lifts stand-in art, overlay markers and projectile launch points.
 */

/** Art px per tile of height (orthographic camera at 30 degrees elevation): TILE_W / sqrt(2) * cos 30 = TILE_W / 4 * sqrt(6). */
export const Z_PX = (TILE_W / 4) * Math.sqrt(6);
/** Interior wall height in tiles (walls.HF). */
export const WALL_Z = 1.85;
/** Roof top in tiles: the 0.2 roof slab on the walls, flush with the hull top (walls.hull_top()). */
export const ROOF_Z = 2.05;
/** Skirt top and cutaway wall height in tiles (walls.SKIRT * HF, + walls.CUT). */
export const SKIRT_Z = 0.3 * WALL_Z;
export const CUT_Z = SKIRT_Z + 0.2;

/** Roof top in art px above the floor. */
export const ROOF_H = Math.round(ROOF_Z * Z_PX);

/** Launch height of a shot: the roof turret. Shots descend to ground level at their target. */
export const MUZZLE_H = ROOF_H;
export const IMPACT_H = 6 * ART_SCALE;

/** Height in art px of the walls drawn for a wall view mode (damage decals). */
export function wallTopPx(mode: 'up' | 'auto' | 'down'): number {
  return Math.round((mode === 'up' ? ROOF_Z : mode === 'auto' ? CUT_Z : SKIRT_Z) * Z_PX);
}
