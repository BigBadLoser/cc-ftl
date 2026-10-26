import { describe, expect, it } from 'vitest';
import { alignedScale, createCamera, floorLevel, nearestLevel, SCALE_QUANTUM, zoomLevels } from './camera';
import { ART_SCALE } from './iso';

/** The fractional levels: down to 1/8 (station hubs), with 1 / ART_SCALE among them. */
const below = [...new Set([1 / 8, 3 / 16, 1 / 4, 3 / 8, 1 / ART_SCALE, 1 / 2, 0.75])].filter((z) => z < 1).sort((a, b) => a - b);

describe('zoom levels', () => {
  it('are whole numbers from 1 up, plus fractional ones below 1 down to 1/8', () => {
    expect(zoomLevels(3)).toEqual([...below, 1, 2, 3]);
    expect(zoomLevels(1).every((z) => z <= 1)).toBe(true);
  });
  it('keep the tile grid on whole device px at every level (no seams between tiles and the sprites on them)', () => {
    // The half tile is 64 x 32 world px; at an unaligned scale (1/3: 21.33 px) neighbours round apart.
    for (const z of zoomLevels(4)) {
      expect(Number.isInteger(64 * z) && Number.isInteger(32 * z), `level ${z}`).toBe(true);
      expect(Number.isInteger(z / SCALE_QUANTUM) || Number.isInteger(z), `level ${z}`).toBe(true);
    }
  });
  it('alignedScale snaps a fitted scale down to an aligned one', () => {
    expect(alignedScale(1 / 3)).toBe(5 / 16);
    expect(alignedScale(0.01)).toBe(SCALE_QUANTUM);
    expect(alignedScale(0.75)).toBe(0.75);
    expect(alignedScale(1.4)).toBe(1);
    expect(alignedScale(2)).toBe(2);
    const cam = createCamera(3);
    cam.setExactScale(0.7);
    expect(cam.scale).toBe(11 / 16);
  });
  it('floorLevel never exceeds the fit, and falls back to the smallest level', () => {
    const l = zoomLevels(4);
    expect(floorLevel(l, 2.7)).toBe(2);
    expect(floorLevel(l, 100)).toBe(4);
    expect(floorLevel(l, 0.01)).toBe(l[0]);
  });
  it('nearestLevel snaps on a log scale', () => {
    expect(nearestLevel([1, 2, 3], 1.5)).toBe(2);
    expect(nearestLevel([1, 2, 3], 1.2)).toBe(1);
  });
});

describe('camera', () => {
  it('starts at the old default size: zoom = dpr / ART_SCALE, on a level', () => {
    for (const dpr of [1, 2, 3]) {
      const cam = createCamera(3);
      cam.resize(800, 600, dpr);
      expect(zoomLevels(Math.ceil((3 * dpr) / ART_SCALE))).toContain(cam.zoom);
      expect(cam.zoom).toBe(nearestLevel(zoomLevels(Math.ceil((3 * dpr) / ART_SCALE)), dpr / ART_SCALE));
    }
  });
  it('steps through the levels with zoomAt and stops at both ends', () => {
    const cam = createCamera(2);
    cam.resize(800, 600, 1);
    for (let i = 0; i < 20; i++) cam.zoomAt(2, 400, 300);
    const top = zoomLevels(Math.ceil(2 / ART_SCALE)).at(-1);
    expect(cam.zoom).toBe(top);
    for (let i = 0; i < 20; i++) cam.zoomAt(0.5, 400, 300);
    expect(cam.zoom).toBe(zoomLevels(Math.ceil(2 / ART_SCALE))[0]);
  });
  it('fitZoom takes the largest level that fits', () => {
    const cam = createCamera(3);
    cam.resize(800, 600, 1);
    cam.fitZoom(2.9);
    expect(cam.zoom).toBe(Math.min(2, zoomLevels(Math.ceil(3 / ART_SCALE)).at(-1) as number));
  });
  it('keeps the art point under the cursor fixed while zooming', () => {
    const cam = createCamera(3);
    cam.resize(800, 600, 1);
    const before = cam.toArt(200, 150);
    cam.zoomAt(2, 200, 150);
    const after = cam.toArt(200, 150);
    expect(Math.abs(after.x - before.x)).toBeLessThan(1);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  });
});

describe('framing big things', () => {
  it('a station hub fits: fitZoom goes below 1 and the levels below 1 stay on the ladder', () => {
    const cam = createCamera(3);
    cam.resize(1440, 900, 1);
    cam.fitZoom(0.2);
    expect(cam.zoom).toBe(3 / 16);
    cam.fitZoom(0.01);
    expect(cam.zoom).toBe(1 / 8);
    cam.zoomAt(2, 700, 450);
    expect(cam.zoom).toBe(3 / 16);
  });
});
