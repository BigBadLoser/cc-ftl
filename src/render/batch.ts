import {
  BatchableSprite,
  BatcherPipe,
  colorBitGl,
  compileHighShaderGlProgram,
  DefaultBatcher,
  ExtensionType,
  extensions,
  getBatchSamplersUniformGroup,
  roundPixelsBitGl,
  Shader,
  type Container,
} from 'pixi.js';

/**
 * The renderer's one sprite batcher (it replaces pixi's default). The world is one depth-sorted run of sprites from many sheets;
 * pixi starts a new draw call on every blend mode change and every switch to another batcher, so glow sprites between their
 * bodies and the hull pieces' recolour shader broke the run every few sprites. Here both are per-sprite flags in the vertex
 * data, read by one shader, so they batch with everything else:
 *
 * - **Additive glow** (`batchAdditive`): with premultiplied colour, `normal` blending (src + dst * (1 - src.a)) of a pixel whose
 *   alpha is 0 is `add` blending (src + dst) exactly. So a flagged sprite keeps its colour, outputs alpha 0 and is drawn under the
 *   normal blend. Only the destination's alpha differs (add raises it, this keeps it), which is invisible on an opaque target:
 *   only world sprites opt in, never art drawn into a transparent texture whose alpha is read later (a filter's input, a portrait).
 * - **Hull paint** (`FLAG_PAINT`, set by `HullSprite`): the hull recolour (see hullPaint.ts) runs at the end of the shader.
 *
 * The flags share the 16 bits pixi keeps for the round-pixels switch (bit 0); the texture id stays in the high 16 bits.
 */
export const FLAG_ROUND = 1;
export const FLAG_ADD = 2;
export const FLAG_PAINT = 4;

/** Extra fragment code run last (after `finalColor = outColor * vColor`) for sprites with the flag. */
export interface FlagStep {
  flag: number;
  glsl: string;
}

const steps: FlagStep[] = [];
const shaders = new Map<number, Shader>();
/** Per-renderable flags (on top of round pixels), read when the sprite is packed into a batch. */
const FLAGS = Symbol('batchFlags');
type Flagged = Container & { [FLAGS]?: number };

/** Register a fragment step for a flag bit (module load time, before the first batcher is built). */
export function registerFlagStep(step: FlagStep): void {
  if (shaders.size) throw new Error('batch flag step registered after the batch shader was built');
  steps.push(step);
}

let mergeAdd = true;
/** Debug switch (render diffs): false draws flagged additive sprites as pixi does, in their own `add` batches. */
export function setAdditiveMerge(on: boolean): void {
  mergeAdd = on;
}

export function setBatchFlags(c: Container, flags: number): void {
  (c as Flagged)[FLAGS] = flags;
}

/** Draw a sprite with additive blending inside the normal batch (see above): for glow over the opaque world. */
export function batchAdditive(c: Container): void {
  c.blendMode = 'add';
  setBatchFlags(c, ((c as Flagged)[FLAGS] ?? 0) | FLAG_ADD);
}

/** The flags of a batched element: its renderable's own, with FLAG_ADD only while it really blends additively. */
function flagsOf(r: Flagged | undefined): number {
  const f = r?.[FLAGS];
  if (!f) return 0;
  return f & FLAG_ADD && (!mergeAdd || r?.groupBlendMode !== 'add') ? f & ~FLAG_ADD : f;
}

// A flagged additive sprite batches as `normal` (its shader step turns it into add). Pixi reads the blend mode of a batched
// element through this getter when it splits batches; every other sprite reports its own mode as before.
Object.defineProperty(BatchableSprite.prototype, 'blendMode', {
  configurable: true,
  get(this: BatchableSprite) {
    const r = this.renderable as Flagged;
    const m = r.groupBlendMode;
    return m === 'add' && mergeAdd && (r[FLAGS] ?? 0) & FLAG_ADD && this.texture._source.alphaMode !== 'no-premultiply-alpha' ? 'normal' : m;
  },
});


function textureBatchBit(maxTextures: number) {
  const sample: string[] = [];
  for (let i = 0; i < maxTextures; i++) {
    if (i > 0) sample.push('else');
    if (i < maxTextures - 1) sample.push(`if(vTextureId < ${i}.5)`);
    sample.push(`{ outColor = texture(uTextures[${i}], vUV); }`);
  }
  const bit = (flag: number) => `mod(floor(vFlags / ${flag}.0 + 0.0001), 2.0) > 0.5`;
  return {
    name: 'texture-batch-flags-bit',
    vertex: {
      header: /* glsl */ `
        in vec2 aTextureIdAndRound;
        out float vTextureId;
        out float vFlags;
      `,
      main: /* glsl */ `
        vTextureId = aTextureIdAndRound.y;
        vFlags = aTextureIdAndRound.x + 0.5;
      `,
      end: /* glsl */ `
        if (mod(aTextureIdAndRound.x, 2.0) == 1.0) {
          gl_Position.xy = roundPixels(gl_Position.xy, uResolution);
        }
      `,
    },
    fragment: {
      header: /* glsl */ `
        in float vTextureId;
        in float vFlags;
        uniform sampler2D uTextures[${maxTextures}];
      `,
      main: sample.join('\n'),
      // The additive step goes last: it only clears the alpha of whatever colour the other steps made.
      end: [...steps, { flag: FLAG_ADD, glsl: 'finalColor.a = 0.0;' }].map((s) => `if (${bit(s.flag)}) {\n${s.glsl}\n}`).join('\n'),
    },
  };
}

/** Pixi's default batcher with the flag steps in its shader and the flags packed beside the texture id. */
export class FlagBatcher extends DefaultBatcher {
  constructor() {
    super();
    const n = this.maxTextures;
    let s = shaders.get(n);
    if (!s) {
      s = new Shader({
        glProgram: compileHighShaderGlProgram({ name: 'batch-flags', bits: [colorBitGl, textureBatchBit(n), roundPixelsBitGl] }),
        resources: { batchSamplers: getBatchSamplersUniformGroup(n) },
      });
      shaders.set(n, s);
    }
    this.shader = s;
  }

  override packQuadAttributes(...a: Parameters<DefaultBatcher['packQuadAttributes']>): void {
    super.packQuadAttributes(...a);
    const [element, , u32, index, textureId] = a;
    const f = flagsOf((element as unknown as { renderable?: Flagged }).renderable);
    if (!f) return;
    const v = (textureId << 16) | ((element.roundPixels | f) & 0xffff);
    u32[index + 5] = v;
    u32[index + 11] = v;
    u32[index + 17] = v;
    u32[index + 23] = v;
  }

  override packAttributes(...a: Parameters<DefaultBatcher['packAttributes']>): void {
    super.packAttributes(...a);
    const [element, , u32, index, textureId] = a;
    const f = flagsOf((element as unknown as { renderable?: Flagged }).renderable);
    if (!f) return;
    const v = (textureId << 16) | ((element.roundPixels | f) & 0xffff);
    for (let i = 0; i < element.attributeSize; i++) u32[index + i * 6 + 5] = v;
  }
}
(FlagBatcher as unknown as { extension: unknown }).extension = { type: [ExtensionType.Batcher], name: 'default' };

extensions.remove(DefaultBatcher);
extensions.add(FlagBatcher);
// The pipe builds each instruction set's default batcher itself (`new DefaultBatcher()`, not through the registry): hand it ours.
const pipe = BatcherPipe.prototype as unknown as { buildStart(set: { uid: number }): void; _batchersByInstructionSet: Record<number, Record<string, unknown>> };
const buildStart = pipe.buildStart;
pipe.buildStart = function (this: typeof pipe, set) {
  const own = (this._batchersByInstructionSet[set.uid] ??= Object.create(null) as Record<string, unknown>);
  own.default ??= new FlagBatcher();
  buildStart.call(this, set);
};
