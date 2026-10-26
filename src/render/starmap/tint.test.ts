import { describe, expect, it } from 'vitest';
import { KEY_ACCENT, KEY_CLOTH, swapPixel } from './tint';
import { bodyVariant, strHash } from './artIds';
import type { UiStarArt } from '../../ui/starmapApi';

const RED: [number, number, number] = [1, 0, 0];
const BLUE: [number, number, number] = [0, 0, 1];

describe('starmap icon tint', () => {
  it('swaps each key colour for its owner colour, on the shade ramp, and leaves other pixels alone', () => {
    expect(swapPixel([1, 1, 0], [KEY_CLOTH, KEY_ACCENT], [RED, BLUE])).toEqual([1, 0, 0]);
    // A darker shade of the cloth key takes a darker step of the owner colour.
    const dark = swapPixel([0.5, 0.5, 0], [KEY_CLOTH, KEY_ACCENT], [RED, BLUE]);
    expect(dark[0]).toBeGreaterThan(0.4);
    expect(dark[0]).toBeLessThan(0.9);
    expect(swapPixel([0, 0.8, 0.8], [KEY_CLOTH, KEY_ACCENT], [RED, BLUE])[2]).toBeGreaterThan(0.6);
    // Grey hull and black outline are not keys.
    expect(swapPixel([0.4, 0.4, 0.45], [KEY_CLOTH, KEY_ACCENT], [RED, BLUE])).toEqual([0.4, 0.4, 0.45]);
    expect(swapPixel([0, 0, 0], [KEY_CLOTH, KEY_ACCENT], [RED, BLUE])).toEqual([0, 0, 0]);
  });
});

describe('starmap body variants', () => {
  const frame = { x: 0, y: 0, w: 96, h: 96, glow: true };
  const art: UiStarArt = {
    src: '', glow: null, w: 1, h: 1,
    frames: { 'starmap.body.star.v0': frame, 'starmap.body.star.v1': frame, 'starmap.body.star.v2': frame, 'starmap.body.nebula': frame },
  };
  it('picks a variant by seed, the same one every time, and falls back to the plain id', () => {
    const a = bodyVariant(art, 'body', 'star', 'sec:3,4');
    expect(a).toBe(`starmap.body.star.v${strHash('sec:3,4') % 3}`);
    expect(bodyVariant(art, 'body', 'star', 'sec:3,4')).toBe(a);
    const seen = new Set(Array.from({ length: 30 }, (_, i) => bodyVariant(art, 'body', 'star', `s${i}`)));
    expect(seen.size).toBe(3);
    expect(bodyVariant(art, 'body', 'nebula', 'x')).toBe('starmap.body.nebula');
    expect(bodyVariant(art, 'body', 'pulsar', 'x')).toBeNull();
  });
});
