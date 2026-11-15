import { Sprite, type Texture } from 'pixi.js';
import { FLAG_CARPET, registerFlagStep, setBatchFlags } from './batch';
import { paintGlsl } from './hullPaint';

/**
 * Luminance of the carpet art's mid grey as drawn (palette_extra c4H5 after the floor's lighting and quantising: the median
 * of `tile.floor.carpet`'s pixels, #4b4b4c). It is not the hull's reference (HULL_REF_LUM, a lighter grey), so the carpet
 * has its own: the mid grey of the pile lands on the paint, the dark ribs go darker and the speckle lifts. Re-measure it if
 * the carpet's greys change (tools/blender/sprites/deck_finishes.py).
 */
export const CARPET_REF_LUM = 0.295;

registerFlagStep({ flag: FLAG_CARPET, glsl: paintGlsl(CARPET_REF_LUM) });

/**
 * A carpet floor tile (or deck marking in the carpet's grey, the walkway line) recoloured by its tint: the same step as a hull piece (hullPaint.ts), run against CARPET_REF_LUM. The
 * tint is the carpet paint (`carpetPaintFor`) times the light, set like any tile's, so the light still multiplies in.
 */
export class CarpetSprite extends Sprite {
  constructor(texture: Texture) {
    super(texture);
    setBatchFlags(this, FLAG_CARPET);
  }
}
