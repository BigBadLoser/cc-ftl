import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import { content } from '../content';
import { layerKey, moduleLayers } from './moduleArt';

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
});
