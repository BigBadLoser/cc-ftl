import { describe, expect, it } from 'vitest';
import { ART_SCALE, iso, TILE_H, TILE_W, tileAt, unIso } from './iso';

describe('iso', () => {
  it('round-trips', () => {
    const p = iso(5, 3);
    expect(p).toEqual({ x: 2 * (TILE_W / 2), y: 8 * (TILE_H / 2) });
    const q = unIso(p.x, p.y);
    expect(q.x).toBeCloseTo(5);
    expect(q.y).toBeCloseTo(3);
  });
  it('picks diamond-accurately', () => {
    const c = iso(4, 2);
    expect(tileAt(c.x, c.y)).toEqual({ x: 4, y: 2 });
    expect(tileAt(c.x + 0.47 * TILE_W, c.y)).toEqual({ x: 4, y: 2 });
    expect(tileAt(c.x + 0.31 * TILE_W, c.y + 0.44 * TILE_H)).toEqual({ x: 5, y: 2 });
    expect(tileAt(c.x - 0.31 * TILE_W, c.y - 0.44 * TILE_H)).toEqual({ x: 3, y: 2 });
  });
  it('is a 2:1 diamond and the art scale follows the tile width', () => {
    expect(TILE_W).toBe(2 * TILE_H);
    expect(ART_SCALE).toBe(TILE_W / 64);
  });
});
