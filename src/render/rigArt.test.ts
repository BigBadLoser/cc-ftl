import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ } from './moduleArt';
import { rigInputs, rigLayers } from './rigArt';

const def = { asset: 'module.surgery_rig', footprint: [1, 1], rig: { bed: 'module.med_bed' } } as unknown as ModuleDef;
const m = { def: 'module.surgery_rig', x: 3, y: 4, rot: 1 } as Module;

describe('surgical rig art (#311)', () => {
  it('draws only the body while it faces no bed', () => {
    const layers = rigLayers(m, def, { bedFront: null, active: false });
    expect(layers.map((l) => l.chain)).toEqual([['module.surgery_rig.r1.idle', 'module.surgery_rig.r1', 'module.surgery_rig.idle', 'module.surgery_rig']]);
  });

  it('adds an optional front overlay sorted at the bed, active while operating', () => {
    const [body, front] = rigLayers(m, def, { bedFront: { x: 2, y: 5 }, active: true });
    expect(body?.chain[0]).toBe('module.surgery_rig.r1.active');
    expect(front).toMatchObject({ key: 'module.surgery_rig.front', dz: FRONT_DZ, sortAt: { x: 2, y: 5 }, optional: true });
    expect(front?.chain).toEqual(['module.surgery_rig.front.r1.active', 'module.surgery_rig.front.r1', 'module.surgery_rig.front.active', 'module.surgery_rig.front']);
    expect(rigInputs({ bedFront: { x: 2, y: 5 }, active: true })).not.toBe(rigInputs({ bedFront: { x: 2, y: 5 }, active: false }));
  });
});
