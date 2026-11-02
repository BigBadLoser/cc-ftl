import { describe, expect, it } from 'vitest';
import { ART_SCALE } from './iso';
import { LEVEL_ART_PX, slotOffset, STACK_UNITS, unitCount } from './stackSlots';

describe('unitCount', () => {
  it('shows nothing for an empty stack and at least one unit for any stock', () => {
    expect(unitCount(0, 100)).toBe(0);
    expect(unitCount(1, 100)).toBe(1);
  });
  it('adds a unit per twelfth of a full stack and caps at a full stack', () => {
    expect(unitCount(100 / 12, 100)).toBe(1);
    expect(unitCount(9, 100)).toBe(2);
    expect(unitCount(50, 100)).toBe(6);
    expect(unitCount(100, 100)).toBe(STACK_UNITS);
    expect(unitCount(250, 100)).toBe(STACK_UNITS);
  });
});

describe('slotOffset', () => {
  it('draws back, right, left, front: back is highest on screen and front lowest', () => {
    const back = slotOffset(0);
    const right = slotOffset(1);
    const left = slotOffset(2);
    const front = slotOffset(3);
    expect(back.x).toBe(0);
    expect(front.x).toBe(0);
    expect(back.y).toBeLessThan(right.y);
    expect(right.y).toBe(left.y);
    expect(left.y).toBeLessThan(front.y);
    expect(right.x).toBeGreaterThan(0);
    expect(left.x).toBe(-right.x);
  });
  it('raises each level by the level step, keeping the slot', () => {
    for (let i = 0; i < 4; i++) {
      expect(slotOffset(i + 4).x).toBe(slotOffset(i).x);
      expect(slotOffset(i + 8).y).toBe(slotOffset(i).y - 2 * LEVEL_ART_PX * ART_SCALE);
    }
  });
  it('snaps to whole art px', () => {
    for (let i = 0; i < STACK_UNITS; i++) {
      const o = slotOffset(i);
      expect(Math.abs(o.x % ART_SCALE)).toBe(0);
      expect(Math.abs(o.y % ART_SCALE)).toBe(0);
    }
  });
});
