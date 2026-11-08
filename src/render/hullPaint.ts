import { Sprite, type Texture } from 'pixi.js';
import { FLAG_PAINT, registerFlagStep, setBatchFlags } from './batch';

/** Luminance of the hull art's mid tone (the median of the run pieces' px): the shade that takes the paint as is. */
export const HULL_REF_LUM = 0.607;
/** Shades lighter than the mid tone keep this share of their lift, so light paints keep their highlights' detail. */
export const HULL_HIGHLIGHT = 0.5;

/**
 * Hull recolour, after the roof's livery recolour (livery.ts), as a flag step at the end of the batch shader (batch.ts): a hull
 * pixel takes its sprite's tint (the paint times the light, set on the CPU like any tint) as its colour, its shading
 * kept as s = lum(pixel) / HULL_REF_LUM. The mid faces land on the paint (as a roof coat does); lighter faces lift by
 * HULL_HIGHLIGHT of their ratio, darker ones darken in full. Unlike a multiply tint it brightens, so light and warm
 * paints reach their colour over the cool grey art.
 */
const hullPaintGlsl = /* glsl */ `
        if (outColor.a > 0.0 && vColor.a > 0.0) {
            float s = dot(outColor.rgb / outColor.a, vec3(0.299, 0.587, 0.114)) / ${HULL_REF_LUM.toFixed(3)};
            if (s > 1.0) s = 1.0 + (s - 1.0) * ${HULL_HIGHLIGHT.toFixed(3)};
            vec3 c = clamp(vColor.rgb / vColor.a * s, 0.0, 1.0);
            finalColor = vec4(c, 1.0) * outColor.a * vColor.a;
        }
`;

registerFlagStep({ flag: FLAG_PAINT, glsl: hullPaintGlsl });

/** A hull piece recoloured by its tint (the paint times the light): a sprite whose batch flag runs the step above. */
export class HullSprite extends Sprite {
  constructor(texture: Texture) {
    super(texture);
    setBatchFlags(this, FLAG_PAINT);
  }
}
