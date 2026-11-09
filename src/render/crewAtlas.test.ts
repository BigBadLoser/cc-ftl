import { describe, expect, it } from 'vitest';
import { ART_SCALE } from './iso';
import { crewCellGeometry } from './crewAtlas';
import { crewPalette, paletteKeys } from './assets/palette';
import type { Manifest } from './assets/manifest';

const layer = (frameW: number, frameH: number, x: number, y: number) => ({ kind: 'crew.layer', frameW, frameH, anchor: { x, y } });

describe('crewCellGeometry', () => {
  it('fits every crew layer frame around the feet, with room for the outline', () => {
    const assets = { a: layer(128, 120, 64, 94), b: layer(90, 150, 30, 140), s: { kind: 'static' } } as unknown as Manifest['assets'];
    const g = crewCellGeometry({ assets });
    const pad = (g.w - (64 + 64)) / 2;
    expect(pad).toBeGreaterThanOrEqual(ART_SCALE + 1); // the outline reaches one art px past the figure, linear sampling one more texel
    expect(g.ox).toBe(64 + pad);
    expect(g.oy).toBe(140 + pad);
    expect(g.h).toBe(140 + 26 + 2 * pad);
    for (const a of [layer(128, 120, 64, 94), layer(90, 150, 30, 140)]) {
      expect(g.ox - a.anchor.x).toBeGreaterThanOrEqual(pad);
      expect(g.oy - a.anchor.y).toBeGreaterThanOrEqual(pad);
      expect(g.w - (g.ox - a.anchor.x + a.frameW)).toBeGreaterThanOrEqual(pad);
      expect(g.h - (g.oy - a.anchor.y + a.frameH)).toBeGreaterThanOrEqual(pad);
    }
  });
});

describe('paletteKeys', () => {
  it('maps each key colour to the crew colour its name ends in (anything else is cloth), in manifest order', () => {
    const { keys, roles } = paletteKeys({ 'team.skin': '#ff00ff', 'team.hair': '#00ff00', 'team.cloth': '#ffff00', 'team.accent': '#00ffff', 'team.boots': '#123456' });
    expect(roles).toEqual(['skin', 'hair', 'cloth', 'accent', 'cloth']);
    expect([...keys.slice(0, 3)]).toEqual([1, 0, 1]);
    expect(keys[16]).toBeCloseTo(0x12 / 255, 6);
    const pal = crewPalette(7);
    expect(roles.map((r) => pal[r])).toEqual([pal.skin, pal.hair, pal.cloth, pal.accent, pal.cloth]);
  });
});
