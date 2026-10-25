import { describe, expect, it } from 'vitest';
import { cropRect, HEAD_CROP, HEAD_CROP_H, portraitKey } from './portraitMath';

describe('portraitKey', () => {
  it('is stable and changes with each part of the look', () => {
    const k = portraitKey('species.human', 'role.medic', 7, undefined);
    expect(portraitKey('species.human', 'role.medic', 7, undefined)).toBe(k);
    for (const o of [portraitKey('species.robot', 'role.medic', 7, undefined), portraitKey('species.human', 'role.pilot', 7, undefined), portraitKey('species.human', 'role.medic', 8, undefined), portraitKey('species.human', 'role.medic', 7, 'rifle')]) expect(o).not.toBe(k);
  });
});

describe('cropRect', () => {
  const body = { ox: 47, oy: 32, w: 34, h: 69, ax: 64, ay: 94 };
  it('crops a humanoid head square centred on the anchor, just above the body top', () => {
    const r = cropRect(body, true);
    expect(r).toEqual({ x: -HEAD_CROP / 2, y: 32 - 94 - 2, w: HEAD_CROP, h: HEAD_CROP_H });
  });
  it('crops the top of a single body, centred on its cell, in whole art px', () => {
    const r = cropRect({ ox: 10, oy: 11, w: 41, h: 60, ax: 36, ay: 58 }, false);
    expect(r.w).toBe(40);
    expect(r.h).toBe(40);
    expect(Math.abs(r.x % 2)).toBe(0);
    expect(Math.abs(r.y % 2)).toBe(0);
    expect(r.y).toBe(-48);
  });
});
