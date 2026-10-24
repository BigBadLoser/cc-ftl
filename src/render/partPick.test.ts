import { describe, expect, it } from 'vitest';
import type { Texture } from 'pixi.js';
import { buildMask, keepMask } from './assets/alphaMask';
import { pickParts, type PickPart } from './partPick';

const W = 8;
const H = 8;
/** An 8x8 sheet, opaque except the top-left 3x3 corner. */
const alphaAt = (x: number, y: number): number => (x < 3 && y < 3 ? 0 : 255);

/** A decoded bitmap that can be closed like an ImageBitmap: drawing it afterwards throws. */
function bitmap() {
  const b = { closed: false, close() { this.closed = true; } };
  const ctx = (_w: number, h: number) => {
    let strip: [number, number] = [0, h];
    return {
      clearRect: () => undefined,
      drawImage: (...a: unknown[]) => {
        if (b.closed) throw new Error('InvalidStateError: closed bitmap');
        strip = [a[2] as number, a[4] as number];
      },
      getImageData: (_x: number, _y: number, w: number, hh: number) => {
        const data = new Uint8ClampedArray(w * hh * 4);
        for (let i = 0; i < w * hh; i++) data[i * 4 + 3] = alphaAt(i % w, strip[0] + Math.floor(i / w));
        return { data };
      },
    };
  };
  return { b, ctx };
}

function part(source: object, frame: { x: number; y: number; width: number; height: number }): PickPart {
  const texture = { source, frame } as unknown as Texture;
  return { spr: { texture }, rect: { x0: 100, y0: 50, x1: 100 + frame.width, y1: 50 + frame.height }, key: 1, flip: false };
}

describe('pickParts with a closed sheet bitmap', () => {
  it('rejects a click on a transparent corner and accepts an opaque pixel, after the bitmap was closed', () => {
    const { b, ctx } = bitmap();
    const source = { resource: b };
    const m = buildMask(b, W, H, ctx);
    expect(m).not.toBeNull();
    keepMask(source, m!);
    b.close(); // what the loader does after the GPU upload
    const mods: [number, { parts: PickPart[] }][] = [[7, { parts: [part(source, { x: 0, y: 0, width: W, height: H })] }]];
    expect(pickParts(mods, 100.5, 50.5)).toBeNull(); // transparent corner (inside the rect)
    expect(pickParts(mods, 102.5, 52.5)).toBeNull();
    expect(pickParts(mods, 105.5, 55.5)).toBe(7);
    expect(pickParts(mods, 103.5, 50.5)).toBe(7);
  });
  it('lets an opaque sprite behind pass when the one on top is transparent at the click', () => {
    const { b, ctx } = bitmap();
    const top = { resource: b };
    keepMask(top, buildMask(b, W, H, ctx)!);
    b.close();
    const a = part(top, { x: 0, y: 0, width: W, height: H });
    a.key = 2;
    const under = part({ resource: null, dummy: 1 }, { x: 0, y: 0, width: W, height: H });
    // `under` has no mask and no readable bitmap: the fallback accepts its whole rectangle.
    const mods: [number, { parts: PickPart[] }][] = [[1, { parts: [under] }], [2, { parts: [a] }]];
    expect(pickParts(mods, 100.5, 50.5)).toBe(1);
    expect(pickParts(mods, 105.5, 55.5)).toBe(2);
  });
});
