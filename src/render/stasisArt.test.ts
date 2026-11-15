import { describe, expect, it } from 'vitest';
import { content } from '../content';
import { CrewC, JobC, type Crew, type Job } from '../sim/crew/components';
import { World } from '../sim/ecs';
import { ModuleC, type Module } from '../sim/modules/components';
import { SLOT_EMPTY, StasisWheelC } from '../sim/stasis/components';
import { stowWork } from '../sim/stasis/ring';
import { stasisLayers, slotOrder } from './stasisArt';
import { HATCH_FRAMES, LOAD_TICKS } from './stasisLoad';

describe('stasis art', () => {
  it('draws the slots back to front, the hatch corner last at rotation 0', () => {
    const o = slotOrder(0);
    expect(o).toHaveLength(10);
    expect(o[o.length - 1]).toBe(0);
  });

  it('keeps the stowed prisoner pressed into the slab through the loading patches and the closing star step', () => {
    const world = new World();
    const def = content.modules['module.stasis_wheel'];
    const wheel = world.createEntity();
    const m = { def: 'module.stasis_wheel', x: 4, y: 4, rot: 0, hp: 100, enabled: true, powered: true, reservedBy: 0, powerPriority: 3 } as Module;
    world.add(wheel, ModuleC, m);
    world.add(wheel, StasisWheelC, { slots: new Array<number>(10).fill(SLOT_EMPTY) });
    const prisoner = world.createEntity();
    world.add(prisoner, CrewC, { name: 'Held' } as Crew);
    const carrier = world.createEntity();
    const job = world.createEntity();
    const j = { kind: 'stasis', work: stowWork(0), progress: 1, reservedBy: carrier, target: prisoner, stasis: { phase: 'stow', wheel, turns: 0 } } as unknown as Job;
    world.add(job, JobC, j);
    const look = world.get(prisoner, CrewC);
    const at = (tick: number) => { j.progress = Math.max(1, ((tick + 0.5) / LOAD_TICKS) * j.work); return stasisLayers(world, wheel, m, def, true); };
    expect(at(HATCH_FRAMES.indexOf('hc12')).find((l) => l.key.endsWith('.load'))?.face).toBe(look);   // a tipping patch
    const home = at(LOAD_TICKS - 1);                                                                    // the star step, the slab home
    expect(home.find((l) => l.key.endsWith('.slot0'))?.face).toBe(look);
  });
});
