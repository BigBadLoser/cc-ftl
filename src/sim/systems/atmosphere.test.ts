import { describe, expect, it } from 'vitest';
import { CrewC, HealthC, PathC, PositionC } from '../crew/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { gridFromTemplate, spawnTemplateModules } from '../ship';
import { roomTiles } from '../roomIndex';
import { Sim } from '../sim';
import type { SimEvent } from '../events';
import { Struct } from '../structure';
import { ModuleC } from '../modules/components';
import { CREW_MAX_HP } from '../tuning';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: true, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: {
    reactor: mod({ footprint: [2, 2], power: 20 }),
    ls: mod({ power: -6, priority: 1, o2PerSec: 3, co2ScrubPerSec: 1 }),
    light: mod({ solid: false, power: -1, priority: 2, light: { radius: 6, level: 230 } }),
  },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};

// Two 3x3 rooms joined by a door at (5, 3), surrounded by space.
const rows = [
  '...........',
  '.#########.',
  '.#___#___#.',
  '.#___D___#.',
  '.#___#___#.',
  '.#########.',
  '...........',
];
const modules = [
  { def: 'reactor', x: 6, y: 2, rot: 0 },
  { def: 'ls', x: 2, y: 2, rot: 0 },
  { def: 'light', x: 4, y: 4, rot: 0 },
  { def: 'light', x: 8, y: 4, rot: 0 },
];

function make(withModules = true): Sim {
  const sim = new Sim(5, content);
  sim.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
  if (withModules) spawnTemplateModules(sim, 1, { name: 't', rows, modules });
  return sim;
}
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const secs = (s: number) => s * 20;
function avgO2(sim: Sim, x0: number, x1: number): number {
  const g = sim.grids.get(1)!;
  let sum = 0;
  let n = 0;
  for (let y = 2; y <= 4; y++) for (let x = x0; x <= x1; x++) { sum += g.get('o2', x, y); n++; }
  return sum / n;
}
const left = (s: Sim) => avgO2(s, 2, 4);
const right = (s: Sim) => avgO2(s, 6, 8);

function breathing(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId: 1, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}

describe('atmosphere', () => {
  it('starts normal and stays stable in sealed rooms', () => {
    const sim = make();
    run(sim, secs(30));
    expect(left(sim)).toBeCloseTo(21, 1);
    expect(right(sim)).toBeCloseTo(21, 1);
    expect(sim.grids.get(1)!.get('o2', 0, 0)).toBe(0);
  });

  it('a hull breach vents its room, a closed door protects the next, an open door does not', () => {
    const sim = make();
    const events: SimEvent[] = [];
    sim.enqueue({ type: 'debug.setStruct', gridId: 1, x: 1, y: 3, kind: Struct.Floor });
    run(sim, secs(40));
    events.push(...sim.events.drain());
    expect(left(sim)).toBeLessThan(5);
    expect(right(sim)).toBeGreaterThan(18);
    expect(events.filter((e) => e.type === 'hull.breach')).toHaveLength(1);
    expect(events.some((e) => e.type === 'o2.low')).toBe(true);

    // Someone stands in the doorway: it stays open and the second room vents too.
    const guard = breathing(sim, 5, 3);
    sim.world.remove(guard, HealthC);
    run(sim, secs(60));
    expect(right(sim)).toBeLessThan(5);
  });

  it('conserves gas between sealed rooms while a door is held open', () => {
    const sim = make(false);
    const g = sim.grids.get(1)!;
    for (let y = 2; y <= 4; y++) for (let x = 6; x <= 8; x++) g.set('o2', x, y, 0);
    const guard = breathing(sim, 5, 3);
    sim.world.remove(guard, HealthC);
    const total = () => { let t = 0; for (const v of g.raw('o2')) t += v; return t; };
    const before = total();
    run(sim, secs(20));
    expect(total()).toBeCloseTo(before, 1);
    expect(Math.abs(left(sim) - right(sim))).toBeLessThan(1);
  });

  it('grid reports rooms for the two compartments', () => {
    const sim = make();
    sim.step();
    expect(roomTiles(sim.grids.get(1)!).size).toBe(2);
  });
});

describe('power', () => {
  it('disabling the reactor unpowers life support and lights; air thins slowly and light goes out', () => {
    const sim = make();
    const g = sim.grids.get(1)!;
    breathing(sim, 3, 3);
    run(sim, 10);
    expect(g.get('light', 3, 3)).toBeGreaterThan(40);
    const mods = sim.world.query(ModuleC).map((id) => ({ id, m: sim.world.get(id, ModuleC)! }));
    const reactor = mods.find((x) => x.m.def === 'reactor')!;
    expect(mods.filter((x) => x.m.def !== 'reactor').every((x) => x.m.powered)).toBe(true);
    sim.events.drain();
    sim.enqueue({ type: 'module.setEnabled', id: reactor.id, enabled: false });
    run(sim, 2);
    expect(mods.every((x) => !x.m.powered)).toBe(true);
    expect(sim.events.drain().some((e) => e.type === 'power.shortage')).toBe(true);
    const o2Before = left(sim);
    run(sim, secs(60));
    expect(g.get('light', 3, 3)).toBe(0);
    expect(g.get('light', 7, 3)).toBe(0);
    expect(left(sim)).toBeLessThan(o2Before);
    expect(left(sim)).toBeGreaterThan(18); // one crew breathes slowly
  });

  it('a shortage cuts the lowest priority first (ties go to the lower id)', () => {
    const weak: ContentRegistry = { ...content, modules: { ...content.modules, reactor: mod({ footprint: [2, 2], power: 7 }) } };
    const sim = new Sim(5, weak);
    sim.grids.set(1, gridFromTemplate(1, { name: 't', rows }));
    spawnTemplateModules(sim, 1, { name: 't', rows, modules });
    const ids = sim.world.query(ModuleC);
    const byDef = (d: string) => ids.filter((i) => sim.world.get(i, ModuleC)!.def === d);
    const [ls] = byDef('ls') as [number];
    const [l1, l2] = byDef('light') as [number, number];
    const powered = (i: number) => sim.world.get(i, ModuleC)!.powered;
    // Supply 7, demand 8: life support (priority 1) and the first light win; the second light loses the tie.
    sim.step();
    expect([powered(ls), powered(l1), powered(l2)]).toEqual([true, true, false]);
    sim.events.drain();
    // Demote life support: both lights outrank it, and it no longer fits.
    sim.enqueue({ type: 'module.setPriority', id: ls, priority: 5 });
    sim.step();
    expect([powered(ls), powered(l1), powered(l2)]).toEqual([false, true, true]);
    expect(sim.events.drain().filter((e) => e.type === 'power.shortage')).toHaveLength(1);
  });
});
