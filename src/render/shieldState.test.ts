import { describe, expect, it } from 'vitest';
import { DOME_SEC, domeAge, domeVisible, newDome, stepDome } from './shieldState';

describe('shield dome state', () => {
  it('a lost layer plays a break, a returned one a regen', () => {
    const s = newDome(3);
    stepDome(s, 2, false, 1000);
    expect(s.breakAt).toBe(1000);
    expect(domeAge(s.breakAt, DOME_SEC.break, 1000)).toBe(0);
    expect(domeAge(s.breakAt, DOME_SEC.break, 1500)).toBeCloseTo(0.5, 1);
    expect(domeAge(s.breakAt, DOME_SEC.break, 2100)).toBe(-1);
    stepDome(s, 3, false, 3000);
    expect(s.regenAt).toBe(3000);
  });

  it('a vent or lockout to zero collapses the whole dome instead of breaking a row', () => {
    const s = newDome(3);
    stepDome(s, 0, true, 500);
    expect(s.downAt).toBe(500);
    expect(s.downRows).toBe(3);
    expect(s.breakAt).toBe(-Infinity);
    expect(domeVisible(s, 1000)).toBe(true);
    expect(domeVisible(s, 500 + DOME_SEC.down * 1000 + 1)).toBe(false);
  });

  it('a hit that strips the last layer breaks it (no collapse)', () => {
    const s = newDome(1);
    stepDome(s, 0, false, 0);
    expect(s.breakAt).toBe(0);
    expect(s.downAt).toBe(-Infinity);
    expect(domeVisible(s, 500)).toBe(true);
    expect(domeVisible(s, 1200)).toBe(false);
  });

  it('ages step at the dome frame rate', () => {
    const a = domeAge(0, 1, 40);
    const b = domeAge(0, 1, 90);
    expect(a).toBe(0);
    expect(b).toBeCloseTo(1 / 12, 5);
  });
});
