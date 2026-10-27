import { describe, expect, it } from 'vitest';
import { viewDevicePx } from './combatPass';

describe('combat view device rectangle', () => {
  it('rounds the CSS rectangle to whole device px of the world canvas, so the copy into the panel is 1:1', () => {
    expect(viewDevicePx({ x: 560.5, y: 110.25, w: 401.5, h: 287.75 }, 2)).toEqual({ x: 1121, y: 221, w: 803, h: 576 });
    expect(viewDevicePx({ x: 10, y: 20, w: 300, h: 200 }, 1)).toEqual({ x: 10, y: 20, w: 300, h: 200 });
  });
  it('never makes an empty canvas (a collapsed view still has a 1x1 pixel)', () => {
    expect(viewDevicePx({ x: 0, y: 0, w: 0.2, h: 0 }, 2)).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });
});
