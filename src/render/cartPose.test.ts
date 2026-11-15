import { describe, expect, it } from 'vitest';
import { easeCart } from './cartView';
import { CART_GAP, angleOf, cartAhead, cartFrame, cartFront, headingArt, headingOf, orthoSteps, restPose, type CartPose } from './cartPose';

const Q = Math.PI / 2;

describe('hover cart pose', () => {
  it('names a heading by its push direction: heading 0 is +y, counterclockwise', () => {
    expect(headingOf(angleOf(0, 1))).toBe(0);
    expect(headingOf(angleOf(-1, 0))).toBe(4);
    expect(headingOf(angleOf(0, -1))).toBe(8);
    expect(headingOf(angleOf(1, 0))).toBe(12);
    expect(headingOf(angleOf(-1, 1))).toBe(2);
  });

  it('draws h2..h10 as rendered and the rest as their mirror twin, flipped', () => {
    for (let h = 0; h < 16; h++) {
      const a = headingArt(h);
      expect(a.h).toBeGreaterThanOrEqual(2);
      expect(a.h).toBeLessThanOrEqual(10);
      expect(a.flip).toBe(h < 2 || h > 10);
      if (a.flip) expect((4 - a.h + 16) % 16).toBe(h);
    }
  });

  it('loops the ring frames, the first unsuffixed', () => {
    expect(cartFrame(angleOf(0, -1), 0)).toEqual({ id: 'slab.cart.h8', flip: false });
    expect(cartFrame(angleOf(0, -1), 125).id).toBe('slab.cart.h8.f1');
    expect(cartFrame(angleOf(1, 0), 0)).toEqual({ id: 'slab.cart.h8', flip: true });
  });

  it('pushes the cart ahead along the route, its middle CART_GAP ahead, facing the way they walk', () => {
    const p = cartAhead([{ x: 3, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }], 0)!;
    expect(p.x).toBeCloseTo(3 + CART_GAP);
    expect(p.y).toBe(0);
    expect(headingOf(p.angle)).toBe(12);
    expect(cartFront(p).x).toBeCloseTo(3 + CART_GAP + 0.5);
    expect(cartFront(p).y).toBeCloseTo(0);
  });

  it('waits on the last two tiles before a corner, then stands on the corner tile and the next', () => {
    const route = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 3 }];
    expect(cartAhead(route, 0)).toMatchObject({ x: 1.5, y: 0 });
    expect(cartAhead(route, 0.4)).toMatchObject({ x: 1.5, y: 0 });
    const turned = cartAhead(route.slice(1), 0)!;
    expect(turned).toMatchObject({ x: 2, y: 0.5 });
    expect(headingOf(turned.angle)).toBe(0);
  });

  it('keeps the cart on the tiles walked at every step of a winding route, diagonals included', () => {
    const route = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 4 }, { x: 1, y: 5 }];
    const walked = new Set(orthoSteps(route).tiles.map((t) => `${t.x},${t.y}`));
    for (let i = 0; i < route.length - 1; i++) for (const f of [0, 0.25, 0.5, 0.75, 0.99]) {
      const p = cartAhead(route.slice(i), f)!;
      const dx = -Math.sin(p.angle), dy = Math.cos(p.angle);
      for (const k of [-0.5, 0.5]) {
        const t = `${Math.round(p.x + dx * k)},${Math.round(p.y + dy * k)}`;
        expect(walked.has(t), `step ${i} at ${f}: tile ${t}`).toBe(true);
      }
    }
  });

  it('splits a diagonal step into two straight ones that keep the way it was going', () => {
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 1 }]).tiles).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 1 }]);
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 2 }]).tiles).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]);
    expect(orthoSteps([{ x: 0, y: 0 }, { x: 1, y: 1 }]).first).toBe(2);
  });

  it('rests on the sim\'s tiles pushed away from the carrier, and has no pose without a route', () => {
    expect(cartAhead([{ x: 4, y: 4 }], 0)).toBeNull();
    const a = restPose(4, 4, { x: 5, y: 4, rot: 0 });
    expect(a).toMatchObject({ x: 5.5, y: 4 });
    expect(headingOf(a.angle)).toBe(12);
    const b = restPose(4, 4, { x: 4, y: 2, rot: 1 });
    expect(b).toMatchObject({ x: 4, y: 2.5 });
    expect(headingOf(b.angle)).toBe(8);
  });

  it('eases its middle and angle together, turning the short way round rather than snapping', () => {
    const cur: CartPose = { x: 0, y: 0, angle: 0 };
    const next: CartPose = { x: 1, y: 1, angle: -Q };
    const half = easeCart(cur, next, 0.5);
    expect(half.x).toBeCloseTo(0.5);
    expect(half.angle).toBeCloseTo(-Q / 2);
    // Across the +-pi seam: the short way.
    expect(easeCart({ x: 0, y: 0, angle: Math.PI - 0.1 }, { x: 0, y: 0, angle: -Math.PI + 0.1 }, 0.5).angle).toBeCloseTo(Math.PI);
    // A new carry far away: put there at once.
    expect(easeCart(cur, { x: 9, y: 0, angle: 1 }, 0.1)).toEqual({ x: 9, y: 0, angle: 1 });
  });
});
