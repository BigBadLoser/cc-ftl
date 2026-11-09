import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { createWorldStack } from './worldLayers';
import { frontDepth } from './shuttleView';

const named = (name: string, z: number) => {
  const c = new Container();
  c.label = name;
  c.zIndex = z;
  return c;
};

describe('world stack', () => {
  it('keeps a hidden region hidden whatever its views do to their own layers, and keeps their parts hidden when it shows', () => {
    const W = createWorldStack();
    const r = W.region(false);
    const parts = [r.floor, r.under, r.decal, r.sorted];
    r.setVisible(false); // culled, or still being built
    r.setPartsVisible(parts, true); // a rock roof lifted (an outpost unroofed)
    expect(parts.every((c) => !c.visible)).toBe(true);
    r.setPartsVisible(parts, false); // the rock roof back on
    r.setVisible(true);
    expect(parts.every((c) => !c.visible)).toBe(true);
    expect(r.fx.visible).toBe(true); // the rock roof itself
    r.setPartsVisible(parts, true);
    expect(parts.every((c) => c.visible)).toBe(true);
  });

  it('sorts the sprites of every region by zIndex plus the region depth, and keeps ties in add order', () => {
    const W = createWorldStack();
    const a = W.region(false);
    const b = W.region(false);
    a.setOrigin(0, 0, 0);
    b.setOrigin(0, 0, 10);
    a.sorted.addChild(named('a12', 12), named('a5', 5), named('a10first', 10));
    b.sorted.addChild(named('b0', 0), named('b3', 3));
    W.low.addChild(named('low11', 11));
    expect(W.drawOrder().map((c) => c.label)).toEqual(['a5', 'a10first', 'b0', 'low11', 'a12', 'b3']);
  });

  it('drops a removed sprite from the shared layer', () => {
    const W = createWorldStack();
    const a = W.region(false);
    const s = named('s', 1);
    a.sorted.addChild(s);
    s.destroy();
    expect(W.drawOrder()).toHaveLength(0);
  });
});

describe('frontDepth', () => {
  it('adds the footprint reach toward the viewer to the centre depth', () => {
    // Nose +y (heading pi/2): 2.4 along y, 1.0 across.
    expect(frontDepth(10.5, 20.5, Math.PI / 2)).toBeCloseTo(30 + 2.4 + 1.0);
    // Nose +x+y diagonal: the length reaches 2.4 * sqrt 2 forward, the width nothing.
    expect(frontDepth(0.5, 0.5, Math.PI / 4)).toBeCloseTo(2.4 * Math.SQRT2);
  });
});
