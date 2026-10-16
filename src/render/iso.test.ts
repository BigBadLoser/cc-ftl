import { describe, expect, it } from 'vitest';
import { iso, tileAt, unIso } from './iso';

describe('iso', () => {
  it('round-trips', () => {
    const p = iso(5, 3);
    expect(p).toEqual({ x: 64, y: 128 });
    const q = unIso(p.x, p.y);
    expect(q.x).toBeCloseTo(5);
    expect(q.y).toBeCloseTo(3);
  });
  it('picks diamond-accurately', () => {
    const c = iso(4, 2);
    expect(tileAt(c.x, c.y)).toEqual({ x: 4, y: 2 });
    expect(tileAt(c.x + 30, c.y)).toEqual({ x: 4, y: 2 });
    expect(tileAt(c.x + 20, c.y + 14)).toEqual({ x: 5, y: 2 });
    expect(tileAt(c.x - 20, c.y - 14)).toEqual({ x: 3, y: 2 });
  });
});
