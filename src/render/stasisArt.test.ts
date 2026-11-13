import { describe, expect, it } from 'vitest';
import { CART_GAP, cartAhead, cartFrame, orthoSteps, restPose, slotOrder } from './stasisArt';

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
    // Walking +x from (3,0): the middle CART_GAP ahead, along x (r3: pushed toward +x), anchored on its front tile.
    expect(cartAhead([{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }], 0)).toEqual({ x: 3 + CART_GAP + 0.5, y: 0, rot: 3 });
    // Walking -y: r2 (pushed toward -y), anchored on its front (larger y) tile.
    const p = cartAhead([{ x: 5, y: 5 }, { x: 5, y: 4 }, { x: 5, y: 3 }, { x: 5, y: 2 }], 0)!;
    expect(p.rot).toBe(2);
    expect(p.y).toBeCloseTo(5 - CART_GAP + 0.5);
  });

  it('waits on the last two tiles before a corner, then pivots onto the corner tile and the next', () => {
    // Along +x to the corner (2,0), then +y.
    const route = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }];
    // Leaving (0,0): middle at 1.5, on (1,0)-(2,0): along x.
    expect(cartAhead(route, 0)).toEqual({ x: 2, y: 0, rot: 3 });
    // Halfway along the first step: still held on (1,0)-(2,0), not over the corner.
    expect(cartAhead(route, 0.4)).toEqual({ x: 2, y: 0, rot: 3 });
    // Past the turn: on the corner tile and the next, along +y (r0).
    expect(cartAhead(route.slice(1), 0)).toEqual({ x: 2, y: 1, rot: 0 });
  });

  it('keeps the cart on the tiles walked at every step of a winding route, diagonals included', () => {
    const route = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }];
    const walked = new Set(orthoSteps(route).tiles.map((t) => `${t.x},${t.y}`));
    for (let i = 0; i < route.length - 1; i++) for (const f of [0, 0.25, 0.5, 0.75, 0.99]) {
      const p = cartAhead(route.slice(i), f)!;
      // The two tiles under it, either side of its middle along its axis.
      const fx = p.rot % 2 === 1 ? p.x - 0.5 : p.x, fy = p.rot % 2 === 1 ? p.y : p.y - 0.5;
      for (const k of [-0.5, 0.5]) {
        const tx = Math.round(fx + (p.rot % 2 === 1 ? k : 0)), ty = Math.round(fy + (p.rot % 2 === 1 ? 0 : k));
        expect(walked.has(`${tx},${ty}`), `step ${i} at ${f}: tile ${tx},${ty}`).toBe(true);
      }
    }
  });

  it('splits a diagonal step into two straight ones that keep the way it was going', () => {
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }]).tiles).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }]);
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }]).tiles).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]);
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 1, y: 1 }]).first).toBe(2);
  });

  it('rests on the sim\'s tiles with its bar toward the carrier, and has no pose without a route', () => {
    expect(cartAhead([{ x: 4, y: 4 }], 0)).toBeNull();
    // Rest tiles (5,4)-(6,4) along x, carrier at (4,4): pushed toward +x (r3), anchored on (6,4).
    expect(restPose(4, 4, { x: 5, y: 4, rot: 0 })).toEqual({ x: 6, y: 4, rot: 3 });
    // Rest tiles (4,2)-(4,3) along y, carrier at (4,4) below them: pushed toward -y (r2), anchored on (4,3).
    expect(restPose(4, 4, { x: 4, y: 2, rot: 1 })).toEqual({ x: 4, y: 3, rot: 2 });
  });
});
