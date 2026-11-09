import { describe, expect, it } from 'vitest';
import { BatchableSprite, Sprite, Texture } from 'pixi.js';
import { batchAdditive, FLAG_ADD, FLAG_PAINT, FLAG_ROUND, FlagBatcher, setAdditiveMerge, setBatchFlags } from './batch';


function batchable(s: Sprite): BatchableSprite {
  const b = new BatchableSprite();
  s.groupBlendMode = s.blendMode; // what the render group update would compute for a parentless sprite
  b.renderable = s;
  b.texture = s.texture;
  b.transform = s.groupTransform;
  b.bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 } as BatchableSprite['bounds'];
  b.roundPixels = 1;
  return b;
}

/** The flags packed for each of a quad's four vertices (low 16 bits of the texture-id word). */
function packedFlags(s: Sprite, textureId = 3): number[] {
  // Packing is pure; building a batcher would compile its shader, which needs a GL context.
  const pack = FlagBatcher.prototype.packQuadAttributes;
  const f32 = new Float32Array(24);
  const u32 = new Uint32Array(f32.buffer);
  pack.call({} as FlagBatcher, batchable(s), f32, u32, 0, textureId);
  return [5, 11, 17, 23].map((i) => {
    expect((u32[i] as number) >>> 16).toBe(textureId);
    return (u32[i] as number) & 0xffff;
  });
}

describe('batch flags', () => {
  it('batches a flagged additive sprite as normal, and a plain additive one as add', () => {
    const glow = new Sprite(Texture.WHITE);
    batchAdditive(glow);
    const plain = new Sprite(Texture.WHITE);
    plain.blendMode = 'add';
    expect(batchable(glow).blendMode).toBe('normal');
    expect(batchable(plain).blendMode).toBe('add');
    expect(packedFlags(glow)).toEqual([FLAG_ROUND | FLAG_ADD, FLAG_ROUND | FLAG_ADD, FLAG_ROUND | FLAG_ADD, FLAG_ROUND | FLAG_ADD]);
    expect(packedFlags(plain)).toEqual([FLAG_ROUND, FLAG_ROUND, FLAG_ROUND, FLAG_ROUND]);
  });

  it('drops the add flag when the sprite no longer blends additively, or the merge is off', () => {
    const glow = new Sprite(Texture.WHITE);
    batchAdditive(glow);
    glow.blendMode = 'normal';
    expect(packedFlags(glow)[0]).toBe(FLAG_ROUND);
    glow.blendMode = 'add';
    setAdditiveMerge(false);
    try {
      expect(batchable(glow).blendMode).toBe('add');
      expect(packedFlags(glow)[0]).toBe(FLAG_ROUND);
    } finally {
      setAdditiveMerge(true);
    }
  });

  it('packs other flags beside round pixels', () => {
    const hull = new Sprite(Texture.WHITE);
    setBatchFlags(hull, FLAG_PAINT);
    expect(packedFlags(hull)[0]).toBe(FLAG_ROUND | FLAG_PAINT);
  });
});
