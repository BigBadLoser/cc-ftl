import {
  colorBitGl,
  compileHighShaderGlProgram,
  DefaultBatcher,
  ExtensionType,
  extensions,
  generateTextureBatchBitGl,
  getBatchSamplersUniformGroup,
  roundPixelsBitGl,
  Shader,
  Sprite,
  SpritePipe,
  type BatchableSprite,
  type Texture,
} from 'pixi.js';

/** Luminance of the hull art's mid tone (the median of the run pieces' px): the shade that takes the paint as is. */
export const HULL_REF_LUM = 0.607;
/** Shades lighter than the mid tone keep this share of their lift, so light paints keep their highlights' detail. */
export const HULL_HIGHLIGHT = 0.5;

/**
 * Hull recolour, after the roof's livery recolour (livery.ts), as a step at the end of pixi's batch shader: a hull
 * pixel takes its sprite's tint (the paint times the light, set on the CPU like any tint) as its colour, its shading
 * kept as s = lum(pixel) / HULL_REF_LUM. The mid faces land on the paint (as a roof coat does); lighter faces lift by
 * HULL_HIGHLIGHT of their ratio, darker ones darken in full. Unlike a multiply tint it brightens, so light and warm
 * paints reach their colour over the cool grey art.
 */
const hullPaintBitGl = {
  name: 'hull-paint-bit',
  fragment: {
    end: /* glsl */ `
        if (outColor.a > 0.0 && vColor.a > 0.0) {
            float s = dot(outColor.rgb / outColor.a, vec3(0.299, 0.587, 0.114)) / ${HULL_REF_LUM.toFixed(3)};
            if (s > 1.0) s = 1.0 + (s - 1.0) * ${HULL_HIGHLIGHT.toFixed(3)};
            vec3 c = clamp(vColor.rgb / vColor.a * s, 0.0, 1.0);
            finalColor = vec4(c, 1.0) * outColor.a * vColor.a;
        }
    `,
  },
};

let shader: Shader | undefined;

/** The default batcher with the hull recolour step: hull sprites batch with each other as any sprites do. */
class HullBatcher extends DefaultBatcher {
  constructor() {
    super();
    (this as { name: string }).name = 'hull';
    this.shader = shader ??= new Shader({
      glProgram: compileHighShaderGlProgram({ name: 'hull-batch', bits: [colorBitGl, generateTextureBatchBitGl(this.maxTextures), roundPixelsBitGl, hullPaintBitGl] }),
      resources: { batchSamplers: getBatchSamplersUniformGroup(this.maxTextures) },
    });
  }
}

/** The sprite pipe, its sprites drawn by the hull batcher. */
class HullSpritePipe extends SpritePipe {}
// SpritePipe makes each sprite's batchable in a private method: hull sprites go to the hull batcher, every other one to
// the default (the batchables are pooled, so each must be set: a reused one would keep the hull batcher).
const proto = SpritePipe.prototype as unknown as { _initGPUSprite(s: Sprite): BatchableSprite };
const initGPUSprite = proto._initGPUSprite;
proto._initGPUSprite = function (this: SpritePipe, s: Sprite) {
  const b = initGPUSprite.call(this, s);
  b.batcherName = s instanceof HullSprite ? 'hull' : 'default';
  return b;
};

extensions.add(
  { type: ExtensionType.Batcher, name: 'hull', ref: HullBatcher },
  { type: [ExtensionType.WebGLPipes, ExtensionType.WebGPUPipes, ExtensionType.CanvasPipes], name: 'hullSprite', ref: HullSpritePipe },
);

/** A hull piece recoloured by its tint (the paint times the light): a sprite drawn by the hull batcher. */
export class HullSprite extends Sprite {
  constructor(texture: Texture) {
    super(texture);
    (this as { renderPipeId: string }).renderPipeId = 'hullSprite';
  }
}
