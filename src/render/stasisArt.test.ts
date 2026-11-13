import { describe, expect, it } from 'vitest';
import { CART_GAP, cartAhead, cartFrame, restPose, slotOrder } from './stasisArt';

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

  it('pushes the cart ahead along the route, its bar toward the carrier', () => {
    // Walking +x: the middle CART_GAP ahead, along x (r3: pushed toward +x), anchored on its front tile.
    expect(cartAhead(3, 0, [{ x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }], 0)).toEqual({ x: 3 + CART_GAP + 0.5, y: 0, rot: 3 });
    // Walking -y: r2 (pushed toward -y), the front tile the nearer one.
    const p = cartAhead(5, 5, [{ x: 5, y: 4 }, { x: 5, y: 3 }], 1)!;
    expect(p.rot).toBe(2);
    expect(p.y).toBeCloseTo(5 - CART_GAP + 0.5);
  });

  it('turns with the route', () => {
    // A corner just ahead: the cart is already round it.
    expect(cartAhead(0, 0, [{ x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0.2, y: 2 }], 3)!.rot).toBe(0);
  });

  it('rests on the sim\'s tiles with its bar toward the carrier, and has no pose without a route', () => {
    expect(cartAhead(4, 4, [], 3)).toBeNull();
    // Rest tiles (5,4)-(6,4) along x, carrier at (4,4): pushed toward +x (r3), anchored on (6,4).
    expect(restPose(4, 4, { x: 5, y: 4, rot: 0 })).toEqual({ x: 6, y: 4, rot: 3 });
    // Rest tiles (4,2)-(4,3) along y, carrier at (4,4) below them: pushed toward -y (r2), anchored on (4,3).
    expect(restPose(4, 4, { x: 4, y: 2, rot: 1 })).toEqual({ x: 4, y: 3, rot: 2 });
  });
});
