import { describe, expect, it } from 'vitest';
import { clampNumber, parseEntry, stepValue } from './numberStepper';

describe('numberStepper helpers', () => {
  it('clamps', () => {
    expect(clampNumber(5, 1, 3)).toBe(3);
    expect(clampNumber(-1, 0, 3)).toBe(0);
    expect(clampNumber(2, 0, 3)).toBe(2);
  });
  it('steps by a fixed size and clamps at the ends', () => {
    expect(stepValue(5, 1, 2, 1, 10)).toBe(7);
    expect(stepValue(9, 1, 2, 1, 10)).toBe(10);
    expect(stepValue(2, -1, 5, 1, 10)).toBe(1);
  });
  it('steps with a function spec (accelerating step)', () => {
    const accel = (v: number, d: 1 | -1) => v + d * (v >= 20 ? 5 : 1);
    expect(stepValue(19, 1, accel, 1, 999)).toBe(20);
    expect(stepValue(20, 1, accel, 1, 999)).toBe(25);
    expect(stepValue(1, -1, accel, 1, 999)).toBe(1);
  });
  it('parses typed entry', () => {
    expect(parseEntry(' 12 ', 3, 1, 99)).toBe(12);
    expect(parseEntry('500', 3, 1, 99)).toBe(99);
    expect(parseEntry('0', 3, 1, 99)).toBe(1);
    expect(parseEntry('abc', 3, 1, 99)).toBe(3);
    expect(parseEntry('', 3, 1, 99)).toBe(3);
    expect(parseEntry('4.6', 3, 1, 99)).toBe(5);
  });
});
