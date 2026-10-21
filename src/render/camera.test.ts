import { describe, expect, it } from 'vitest';
import { createCamera, fitLevel, zoomLevel } from './camera';

describe('camera zoom levels', () => {
  it('keeps integer scales from 1 up and a few even fractions below 1 (for station hubs)', () => {
    expect(zoomLevel(2.4, 6)).toBe(2);
    expect(zoomLevel(9, 6)).toBe(6);
    expect(zoomLevel(0.3, 6)).toBe(1 / 3);
    expect(zoomLevel(0.01, 6)).toBe(1 / 8);
    expect(fitLevel(0.3, 6)).toBe(1 / 4);
    expect(fitLevel(3.9, 6)).toBe(3);
    expect(fitLevel(0.01, 6)).toBe(1 / 8);
  });

  it('wheel steps walk down through the fractions and back up', () => {
    const cam = createCamera(4);
    cam.resize(800, 600, 1);
    for (let i = 0; i < 3; i++) cam.zoomAt(0.5, 400, 300);
    expect(cam.zoom).toBeLessThan(1);
    for (let i = 0; i < 6; i++) cam.zoomAt(2, 400, 300);
    expect(cam.zoom).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(cam.zoom)).toBe(true);
  });
});
