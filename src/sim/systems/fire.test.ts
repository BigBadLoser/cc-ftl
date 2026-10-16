import { describe, expect, it } from 'vitest';
import {
  CrewC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import type { SimEvent } from '../events';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { gridFromTemplate, spawnTemplateModules } from '../ship';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: { crate: mod({ flammability: 0.6, maxHp: 60 }) },
  crewNames: [],
};
const prio = (v: number): Priorities => ({
  firefighting: 1, medical: v, operating: v, repair: v, construction: v, hauling: v, cooking: v,
});

// A 5x4 room with crates along the north wall, in a sealed hull.
const rows = ['.......', '.#####.', '.#___#.', '.#___#.', '.#___#.', '.#####.', '.......'];
const crates = [{ def: 'crate', x: 2, y: 2, rot: 0 }, { def: 'crate', x: 3, y: 2, rot: 0 }, { def: 'crate', x: 4, y: 2, rot: 0 }];

function make(): Sim {
  const sim = new Sim(11, content);
  sim.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
  spawnTemplateModules(sim, 1, { name: 't', rows, modules: crates });
  return sim;
}
function crew(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId: 1, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, prio(4));
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const secs = (s: number) => s * 20;
const burning = (sim: Sim) => sim.grids.get(1)!.raw('fire').filter((f) => f > 0).length;
const meanO2 = (sim: Sim) => {
  const g = sim.grids.get(1)!;
  let sum = 0;
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) sum += g.get('o2', x, y);
  return sum / 9;
};

describe('fire', () => {
  it('spreads over flammable modules, eats oxygen, makes smoke and heat, and damages modules', () => {
    const sim = make();
    const events: SimEvent[] = [];
    sim.enqueue({ type: 'debug.ignite', gridId: 1, x: 3, y: 2 });
    run(sim, secs(20));
    events.push(...sim.events.drain());
    const g = sim.grids.get(1)!;
    expect(burning(sim)).toBeGreaterThan(1);
    expect(meanO2(sim)).toBeLessThan(20);
    expect(g.get('smoke', 3, 2)).toBeGreaterThan(0);
    expect(g.get('temp', 3, 2)).toBeGreaterThan(30);
    const hp = sim.world.query(ModuleC).map((i) => sim.world.get(i, ModuleC)!.hp);
    expect(Math.min(...hp)).toBeLessThan(60);
    expect(events.filter((e) => e.type === 'fire.started')).toHaveLength(1);
  });

  it('is put out by a crew member on a firefighting job', () => {
    const sim = make();
    crew(sim, 3, 4);
    sim.enqueue({ type: 'debug.ignite', gridId: 1, x: 3, y: 2 });
    run(sim, 2);
    expect(sim.world.query(JobC).some((j) => sim.world.get(j, JobC)!.kind === 'extinguish')).toBe(true);
    run(sim, secs(60));
    expect(burning(sim)).toBe(0);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)!.kind === 'extinguish')).toHaveLength(0);
    // The crates were damaged, so repair jobs now exist (or are already done).
    expect(sim.world.query(JobC).every((j) => sim.world.get(j, JobC)!.kind === 'repair')).toBe(true);
  });

  it('dies at once without oxygen', () => {
    const sim = make();
    const g = sim.grids.get(1)!;
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) g.set('o2', x, y, 6);
    sim.enqueue({ type: 'debug.ignite', gridId: 1, x: 3, y: 2 });
    run(sim, secs(5));
    expect(burning(sim)).toBe(0);
  });

  it('burns itself out in a sealed room by using up the oxygen', () => {
    const sim = make();
    sim.enqueue({ type: 'debug.ignite', gridId: 1, x: 3, y: 2 });
    run(sim, secs(120));
    expect(burning(sim)).toBe(0);
    expect(meanO2(sim)).toBeLessThan(13);
    expect(meanO2(sim)).toBeGreaterThan(8);
  });

  it('saves and loads mid-fire without diverging', async () => {
    const { serialize, deserialize } = await import('../save');
    const sim = make();
    sim.enqueue({ type: 'debug.ignite', gridId: 1, x: 3, y: 2 });
    run(sim, secs(8));
    const loaded = deserialize(serialize(sim), content);
    expect(serialize(loaded)).toBe(serialize(sim));
    run(sim, 200);
    run(loaded, 200);
    expect(serialize(loaded)).toBe(serialize(sim));
  });
});
