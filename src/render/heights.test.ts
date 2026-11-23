import { describe, expect, it } from 'vitest';
import { ROOF_H, ROOF_Z, WALL_Z, Z_PX } from './heights';
import { ART_SCALE, TILE_H, TILE_W } from './iso';
import { shippedManifest } from '../../test/support/manifest';

describe('art heights', () => {
  it('match the heights the sprite pipeline wrote to the manifest', () => {
    const m = shippedManifest();
    // The sheets were rendered at this tile size (core.TILE_W/H), at half resolution; the code's TILE_W/H must be ART_SCALE times it.
    expect(m.tile).toEqual({ w: TILE_W / ART_SCALE, h: TILE_H / ART_SCALE });
    expect(m.heights).toBeDefined();
    expect(m.heights?.wall).toBeCloseTo(WALL_Z, 4);
    expect(m.heights?.roof).toBeCloseTo(ROOF_Z, 4);
    expect((m.heights?.zPx ?? 0) * ART_SCALE).toBeCloseTo(Z_PX, 3);
    // Z_PX follows the tile width (a 64 px tile gives 39.19 px per tile of height); the roof is that many whole px.
    expect(Z_PX).toBeCloseTo((TILE_W / 4) * Math.sqrt(6), 6);
    expect(Math.abs(ROOF_H - 80 * ART_SCALE)).toBeLessThanOrEqual(ART_SCALE);
  });
});
