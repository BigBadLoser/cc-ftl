import { describe, expect, it } from 'vitest';
import { ROOF_H, ROOF_Z, WALL_Z, Z_PX } from './heights';
import raw from '../../public/assets/manifest.json?raw';

describe('art heights', () => {
  it('match the heights the sprite pipeline wrote to the manifest', () => {
    const m = JSON.parse(raw) as {
      heights?: { wall: number; roof: number; zPx: number };
    };
    expect(m.heights).toBeDefined();
    expect(m.heights?.wall).toBeCloseTo(WALL_Z, 4);
    expect(m.heights?.roof).toBeCloseTo(ROOF_Z, 4);
    expect(m.heights?.zPx).toBeCloseTo(Z_PX, 3);
    expect(ROOF_H).toBe(80);
  });
});
