import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import { content } from '../content';
import { diagonalFront, layerKey, moduleLayers } from './moduleArt';
import { depthKey } from './iso';

const engine = content.modules['module.engine'];
const m = { def: 'module.engine', x: 24, y: 2, rot: 1 } as unknown as Module;

describe('module layer depth', () => {
  it('sorts a roofed engine under the roof plates of its footprint, an unroofed one at its front tile', () => {
    const layers = moduleLayers(null as never, 1, m, engine, false);
    // Unroofed: the module's own key (front tile) plus the layer order.
    expect(layerKey(engine, m, layers[0]!, 0, false, 31)).toBe(31);
    // Roofed: both the bulkhead and the machine sort just under the plate of the rear-most tile (24, 2), at +0.9.
    const hull = layerKey(engine, m, layers[0]!, 0, true, 31);
    const machine = layerKey(engine, m, layers[1]!, 1, true, 31);
    expect(hull).toBeCloseTo(26.85);
    expect(machine).toBeGreaterThan(hull);
    expect(machine).toBeLessThan(26.9);
  });
  it('sorts the bell by the tile beyond the hull row, roofed or not, so it draws over the hull behind it', () => {
    const layers = moduleLayers(null as never, 1, m, engine, true, true);
    expect(layers.map((l) => l.chain[0])).toEqual(['module.engine.hull.r1', 'module.engine.machine.open.r1.active', 'module.engine.bell.r1.active']);
    expect(layerKey(engine, m, layers[2]!, 2, false, 31)).toBe(34.5);
    expect(layerKey(engine, m, layers[2]!, 2, true, 31)).toBe(34.5);
  });
});

describe('container depth against walls', () => {
  const box = content.modules['container.3x6'];
  const mb = { def: 'container.3x6', x: 10, y: 0, rot: 0, hp: 190 } as unknown as Module;
  const world = { get: () => ({ clamp: 'n' }) } as never;
  it('cuts every container layer into diagonal strips', () => {
    const layers = moduleLayers(world, 7, mb, box!, false, true, { seed: 1 });
    expect(layers.filter((l) => !l.at).every((l) => l.strips)).toBe(true);
    expect(layers.length).toBeGreaterThan(2);
  });
  it('sorts each strip by the front-most footprint tile of its diagonal, so a wall east of the box draws over it', () => {
    // Footprint x 10..12, y 0..5: the old single key was its front tile (12, 5) = 17; a wall at (13, 1) (key 14) lost to it.
    expect(depthKey(12, 5)).toBe(17);
    const wall = depthKey(13, 1);
    const east = diagonalFront(10, 0, 3, 6, 12); // the strip right under that wall
    expect(east).toEqual({ x: 12, y: 0 });
    expect(depthKey(east.x, east.y)).toBeLessThan(wall);
    expect(diagonalFront(10, 0, 3, 6, 5)).toEqual({ x: 10, y: 5 });
    // Every strip's front tile lies inside the footprint.
    for (let d = 5; d <= 12; d++) {
      const f = diagonalFront(10, 0, 3, 6, d);
      expect(f.x).toBeGreaterThanOrEqual(10);
      expect(f.x).toBeLessThanOrEqual(12);
      expect(f.y).toBeGreaterThanOrEqual(0);
      expect(f.y).toBeLessThanOrEqual(5);
      expect(f.x - f.y).toBe(d);
    }
  });
});
