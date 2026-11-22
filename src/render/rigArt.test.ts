import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ } from './moduleArt';
import { rigInputs, rigLayers } from './rigArt';
import type { ModuleLook } from './moduleArt';

const def = { asset: 'module.surgery_rig', footprint: [1, 1], rig: { bed: 'module.med_bed' } } as unknown as ModuleDef;
const m = { def: 'module.surgery_rig', x: 3, y: 4, rot: 1 } as Module;

describe('surgical rig art (#311)', () => {
  it('draws only the body while it faces no bed', () => {
    const layers = rigLayers(m, def, { bedFront: null, active: false, progress: 0, work: 0 });
    expect(layers.map((l) => l.chain)).toEqual([['module.surgery_rig.r1.idle', 'module.surgery_rig.r1', 'module.surgery_rig.idle', 'module.surgery_rig']]);
  });

  it('adds an optional front overlay sorted at the bed, active while operating', () => {
    const [body, front] = rigLayers(m, def, { bedFront: { x: 2, y: 5 }, active: true, progress: 1, work: 100 });
    expect(body?.chain[0]).toBe('module.surgery_rig.r1.active');
    expect(front).toMatchObject({ key: 'module.surgery_rig.front', dz: FRONT_DZ, sortAt: { x: 2, y: 5 }, optional: true });
    expect(front?.chain).toEqual(['module.surgery_rig.front.r1.active', 'module.surgery_rig.front.r1', 'module.surgery_rig.front.active', 'module.surgery_rig.front']);
    expect(rigInputs({ bedFront: { x: 2, y: 5 }, active: true, progress: 1, work: 100 })).not.toBe(rigInputs({ bedFront: { x: 2, y: 5 }, active: false, progress: 0, work: 0 }));
  });

  it('plays the operation frame from the job progress, with the hologram on its own clock', () => {
    const ids = new Set<string>(['module.surgery_rig.front.r1.deploy']);
    for (let i = 1; i < 18; i++) ids.add(`module.surgery_rig.front.r1.deploy.f${i}`);
    for (let i = 1; i < 40; i++) ids.add(`module.surgery_rig.holo.r1.f${i}`);
    ids.add('module.surgery_rig.holo.r1');
    for (const p of ['cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow']) ids.add(`module.surgery_rig.front.r1.${p}`);
    const look = { has: (id: string) => ids.has(id) } as ModuleLook;
    const view = (progress: number) => ({ bedFront: { x: 2, y: 5 }, active: true, progress, work: 4000 });
    const [, front, holo] = rigLayers(m, def, view(60), look); // tick 24: deploy ends at 18, so a cut frame
    expect(front?.chain[0]).toMatch(/^module\.surgery_rig\.front\.r1\.(cut|swap\.cut)/);
    const [, f0, h0] = rigLayers(m, def, view(20), look); // tick 8
    expect(f0?.chain[0]).toBe('module.surgery_rig.front.r1.deploy.f8');
    expect(h0?.chain[0]).toBe('module.surgery_rig.holo.r1.f8');
    expect(holo).toMatchObject({ key: 'module.surgery_rig.holo', glowOver: true, optional: true });
    expect(rigInputs(view(20))).not.toBe(rigInputs(view(40)));
    expect(rigLayers(m, def, { ...view(0), active: false }, look)).toHaveLength(2);
  });
});
