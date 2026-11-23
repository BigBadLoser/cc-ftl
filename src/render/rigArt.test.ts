import { describe, expect, it } from 'vitest';
import type { Module } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { FRONT_DZ } from './moduleArt';
import { rigFitsBed } from '../sim/modules/rig';
import { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC } from '../sim/modules/components';
import { rigInputs, rigLayers, rigMirror, rigView } from './rigArt';
import type { ModuleLook } from './moduleArt';

const def = { asset: 'module.surgery_rig', footprint: [1, 1], rig: { bed: 'module.med_bed' } } as unknown as ModuleDef;
const m = { def: 'module.surgery_rig', x: 3, y: 4, rot: 1 } as Module;

describe('surgical rig art (#311)', () => {
  it('draws only the body while it faces no bed', () => {
    const layers = rigLayers(m, def, { frontAt: null, active: false, progress: 0, work: 0 });
    expect(layers.map((l) => l.chain)).toEqual([['module.surgery_rig.r1.idle', 'module.surgery_rig.r1', 'module.surgery_rig.idle', 'module.surgery_rig']]);
  });

  it('adds an optional front overlay sorted at the bed, active while operating', () => {
    const [body, front] = rigLayers(m, def, { frontAt: { x: 2, y: 5 }, active: true, progress: 1, work: 100 });
    expect(body?.chain[0]).toBe('module.surgery_rig.r1.active');
    expect(front).toMatchObject({ key: 'module.surgery_rig.front', dz: FRONT_DZ, sortAt: { x: 2, y: 5 }, optional: true });
    expect(front?.chain).toEqual(['module.surgery_rig.front.r1.active', 'module.surgery_rig.front.r1', 'module.surgery_rig.front.active', 'module.surgery_rig.front']);
    expect(rigInputs({ frontAt: { x: 2, y: 5 }, active: true, progress: 1, work: 100 })).not.toBe(rigInputs({ frontAt: { x: 2, y: 5 }, active: false, progress: 0, work: 0 }));
  });

  it('plays the operation frame from the job progress, with the hologram on its own clock', () => {
    const ids = new Set<string>(['module.surgery_rig.front.r1.deploy']);
    for (let i = 1; i < 18; i++) ids.add(`module.surgery_rig.front.r1.deploy.f${i}`);
    for (let i = 1; i < 40; i++) ids.add(`module.surgery_rig.holo.r1.f${i}`);
    ids.add('module.surgery_rig.holo.r1');
    for (const p of ['cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow']) ids.add(`module.surgery_rig.front.r1.${p}`);
    const look = { has: (id: string) => ids.has(id) } as ModuleLook;
    const view = (progress: number) => ({ frontAt: { x: 2, y: 5 }, active: true, progress, work: 4000 });
    const [, front, holo] = rigLayers(m, def, view(60), look); // tick 24: deploy ends at 18, so a cut frame
    expect(front?.chain[0]).toMatch(/^module\.surgery_rig\.front\.r1\.(cut|swap\.cut)/);
    const [, f0, h0] = rigLayers(m, def, view(20), look); // tick 8
    expect(f0?.chain[0]).toBe('module.surgery_rig.front.r1.deploy.f8');
    expect(h0?.chain[0]).toBe('module.surgery_rig.holo.r1.f8');
    expect(holo).toMatchObject({ key: 'module.surgery_rig.holo', glowOver: true, optional: true });
    expect(rigInputs(view(20))).not.toBe(rigInputs(view(40)));
    expect(rigLayers(m, def, { ...view(0), active: false }, look)).toHaveLength(2);
  });

  it('mirrors the art on one long side of the bed so the halo reaches its head, at every bed rotation', () => {
    const bed = { footprint: [1, 2] } as unknown as ModuleDef;
    for (let brot = 0; brot < 4; brot++) {
      const fits = [-1, 0, 1, 2].flatMap((y) => [-1, 0, 1, 2].flatMap((x) => [0, 1, 2, 3].map((r) => ({ x, y, r }))))
        .filter((s) => rigFitsBed(def, s.x, s.y, s.r, bed, 0, 0, brot));
      expect(fits).toHaveLength(2);
      expect(fits.map((s) => rigMirror(s.r, bed, { x: 0, y: 0, rot: brot })).sort()).toEqual([false, true]);
    }
    const [body, front] = rigLayers(m, def, { frontAt: { x: 2, y: 5 }, active: false, progress: 0, work: 0, mirror: true });
    expect(body?.chain).toEqual(['module.surgery_rig.m.r1.idle', 'module.surgery_rig.m.r1', 'module.surgery_rig.m.idle', 'module.surgery_rig.m', 'module.surgery_rig']);
    expect(front?.chain[0]).toBe('module.surgery_rig.m.front.r1.idle');
    expect(rigInputs({ frontAt: { x: 2, y: 5 }, active: false, progress: 0, work: 0, mirror: true })).not.toBe(rigInputs({ frontAt: { x: 2, y: 5 }, active: false, progress: 0, work: 0 }));
  });

  it('sorts the front overlay at the rig when it stands nearer the camera than the bed, so the counterweight draws over the column', () => {
    const bed = { asset: 'module.med_bed', bed: true, footprint: [1, 2] } as unknown as ModuleDef;
    const defs = { 'module.surgery_rig': def, 'module.med_bed': bed };
    const w = new World();
    const add = (d: string, x: number, y: number, rot: number): number => {
      const id = w.createEntity();
      w.add(id, ModuleC, { def: d, x, y, rot, hp: 100, powerPriority: 5, enabled: true, powered: true, reservedBy: 0 } as Module);
      return id;
    };
    const b = add('module.med_bed', 2, 2, 0); // head (2, 2), foot (2, 3)
    const grid = { x0: 0, y0: 0, inBounds: () => true, get: () => b } as unknown as Grid;
    const spots = [1, 3].flatMap((x) => [0, 1, 2, 3].map((r) => ({ x, r }))).filter((s) => rigFitsBed(def, s.x, 3, s.r, bed, 2, 2, 0));
    const [far, near] = spots.map((s) => rigView(w, defs, grid, add('module.surgery_rig', s.x, 3, s.r)).frontAt);
    expect(far).toEqual({ x: 2, y: 3 }); // behind the bed: at the bed's foot
    expect(near).toEqual({ x: 3, y: 3 }); // in front of it: at its own tile
  });
});
