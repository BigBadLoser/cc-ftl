import { describe, expect, it } from 'vitest';
import { CART_GAP, cartFrame, cartPose, pushTrail, slotOrder, type TrailPt } from './stasisArt';

const walk = (pts: [number, number][]): TrailPt[] => {
  const t: TrailPt[] = [];
  for (const [x, y] of pts) pushTrail(t, x, y);
  return t;
};

describe('stasis art', () => {
  it('draws the slots back to front, the hatch corner last at rotation 0', () => {
    const o = slotOrder(0);
    expect(o).toHaveLength(10);
    expect(o[o.length - 1]).toBe(0);
  });

  it('loops the cart frames, the first unsuffixed', () => {
    expect(cartFrame(2, 0)).toBe('slab.cart.r2');
    expect(cartFrame(2, 125)).toBe('slab.cart.r2.f1');
    expect(cartFrame(2, 1500)).toBe('slab.cart.r2');
  });

  it('keeps a short trail, newest first', () => {
    const t = walk(Array.from({ length: 40 }, (_, i) => [i * 0.3, 0] as [number, number]));
    expect(t[0]).toEqual({ x: 39 * 0.3, y: 0 });
    expect(t[0]!.x - t[t.length - 1]!.x).toBeLessThan(4);
  });

  it('trails the cart behind the carrier, its bar toward them', () => {
    const t = walk([[0, 0], [1, 0], [2, 0], [3, 0]]);
    // Walking +x: the middle CART_GAP back, lying along x (r1: pushed toward -x, so its bar is at +x), anchored on its front tile.
    expect(cartPose(t, 3, 0, 0)).toEqual({ x: 3 - CART_GAP + 0.5, y: 0, rot: 1 });
    const u = walk([[5, 5], [5, 4], [5, 3], [5, 2]]);
    const p = cartPose(u, 5, 2, 1);
    expect(p.rot).toBe(0);                             // walking -y: r0, pushed toward +y, bar at -y
    expect(p.y).toBeCloseTo(2 + CART_GAP + 0.5);
  });

  it('stays as it was with no way behind the carrier', () => {
    expect(cartPose([], 4, 4, 3)).toEqual({ x: 4.5, y: 4, rot: 3 });
  });
});
