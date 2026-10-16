import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('is deterministic for a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('differs between seeds', () => {
    expect(new Rng(1).next()).not.toBe(new Rng(2).next());
  });

  it('restores state', () => {
    const a = new Rng(7);
    for (let i = 0; i < 10; i++) a.next();
    const state = a.getState();
    const expected = [a.next(), a.next(), a.next()];
    const b = new Rng(0);
    b.setState(state);
    expect([b.next(), b.next(), b.next()]).toEqual(expected);
  });

  it('keeps values in range', () => {
    const r = new Rng(3);
    for (let i = 0; i < 500; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(-2, 3);
      expect(n).toBeGreaterThanOrEqual(-2);
      expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('pick and chance behave', () => {
    const r = new Rng(9);
    expect(['a', 'b']).toContain(r.pick(['a', 'b']));
    expect(() => r.pick([])).toThrow();
    expect(r.chance(0)).toBe(false);
    expect(r.chance(1)).toBe(true);
  });
});
