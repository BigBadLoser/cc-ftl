import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import type { World } from '../sim/ecs';
import { BAY_PLATE_DEPTH, DRONE_DECK_DEPTH, DRONE_BAY_FRONT_DZ, droneBayLayers } from './droneBayArt';

const world = { query: () => [], get: () => undefined } as unknown as World;
const def = { asset: 'module.drone_bay' } as ModuleDef;
const m = { rot: 1 } as Module;

describe('drone bay layers', () => {
  it('draws the bay, then a .front overlay that sorts over a docked drone', () => {
    const [bay, front] = droneBayLayers(world, 1, m, def, false);
    expect(bay?.chain).toContain('module.drone_bay.r1');
    expect(front).toMatchObject({ chain: ['module.drone_bay.r1.front', 'module.drone_bay.r1.front'], optional: true });
    // the module key sits 0.05 behind its front tile; a docked drone sorts at plate + deck depth over it
    expect(DRONE_BAY_FRONT_DZ - 0.05).toBeGreaterThan(BAY_PLATE_DEPTH + DRONE_DECK_DEPTH);
  });
});
