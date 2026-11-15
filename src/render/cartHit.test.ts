import { describe, expect, it } from 'vitest';
import { Container, Texture } from 'pixi.js';
import type { Atlas } from './assets/loader';
import { createCart } from './cartView';

// The hover cart's hit box is its shown sprite, mirrored with it on a flipped heading (crewView.pick: a cart picks its prisoner).
describe('cart hit', () => {
  const tex = Texture.WHITE;
  const atlas = { firstOf: () => ({ tex, glow: null, ax: 4, ay: 10, footprint: [1, 1] }) } as unknown as Atlas;
  const w = tex.width;
  const h = tex.height;

  it('hits inside the sprite box and misses outside, and nothing while hidden', () => {
    const cart = createCart(new Container());
    expect(cart.hit(100, 100)).toBeNull();
    cart.show(atlas, 'slab.cart.h4', false, 100, 100, 0, 0xffffff);
    expect(cart.hit(100 - 4 + 1, 100 - 10 + 1)).toBe(100);
    expect(cart.hit(100 - 4 - 1, 100 - 10 + 1)).toBeNull();
    expect(cart.hit(100 - 4 + w + 1, 100)).toBeNull();
    expect(cart.hit(100, 100 - 10 + h + 1)).toBeNull();
    cart.hide();
    expect(cart.hit(100 - 4 + 1, 100 - 10 + 1)).toBeNull();
  });

  it('mirrors the box with a flipped heading', () => {
    const cart = createCart(new Container());
    cart.show(atlas, 'slab.cart.h4', true, 100, 100, 0, 0xffffff);
    expect(cart.hit(100 + 4 - 1, 100 - 10 + 1)).toBe(100);
    expect(cart.hit(100 + 4 - w - 1, 100 - 10 + 1)).toBeNull();
    expect(cart.hit(100 + 4 + 1, 100 - 10 + 1)).toBeNull();
  });
});
