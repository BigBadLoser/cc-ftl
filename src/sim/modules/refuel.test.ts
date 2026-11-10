import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { storageAdd, storageCount } from '../items/storage';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { ModuleC } from './components';
import { fuelOf } from './energy';
import { spawnModule } from './spawn';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const reactorDef = mod({ solid: true, footprint: [2, 2], power: 50, powerPriority: 1, fuel: { item: 'crystal', store: 6, refillBelow: 3, powerPerUnit: 2000 } });
const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], recipes: {}, structCosts: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, carryCapacity: 20 } },
  modules: { reactor: reactorDef, storage: mod({ solid: true, access: [0, 1], storage: { capacity: 4 } }) },
  items: { crystal: { name: 'c', tags: [], stackSize: 50 } },
};
const rows = ['############', '#__________#', '#__________#', '#__________#', '#__________#', '############'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, farming: v, patrol: v,
});

function setup(stock: number): { sim: Sim; reactor: number; store: number } {
  const sim = new Sim(5, content);
  stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  const reactor = spawnModule(sim, 'reactor', 1, 1, 0);
  const store = spawnModule(sim, 'storage', 8, 1, 0);
  if (stock) storageAdd(sim, store, 'crystal', stock);
  const c = sim.world.createEntity();
  sim.world.add(c, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(c, PositionC, { x: 5, y: 3, toX: 5, toY: 3, progress: 0, facing: 0 });
  sim.world.add(c, PathC, { steps: [] });
  sim.world.add(c, PrioritiesC, { ...all(4), hauling: 1 });
  sim.world.add(c, NeedsC, { rest: 100 });
  return { sim, reactor, store };
}
const fuel = (sim: Sim, id: number): number => fuelOf(sim.world.get(id, ModuleC)!, reactorDef);
const refuelJobs = (sim: Sim): number => sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.kind === 'refuel').length;
const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };

describe('reactor refuelling', () => {
  it('posts no job while the store is at or above half', () => {
    const { sim, reactor } = setup(20);
    sim.world.get(reactor, ModuleC)!.fuel = 3;
    run(sim, 30);
    expect(refuelJobs(sim)).toBe(0);
  });

  it('crew haul crystals from storage into a store that fell below half, up to full', () => {
    const { sim, reactor, store } = setup(20);
    sim.world.get(reactor, ModuleC)!.fuel = 1.5;
    run(sim, 20);
    expect(refuelJobs(sim)).toBe(1);
    run(sim, 600);
    expect(fuel(sim, reactor)).toBeGreaterThan(5.4);
    expect(fuel(sim, reactor)).toBeLessThanOrEqual(6);
    expect(storageCount(sim, store, 'crystal')).toBe(20 - 4); // 4.5 short rounds down: 4 hauled
    expect(refuelJobs(sim)).toBe(0);
  });

  it('posts nothing while the ship holds no crystals', () => {
    const { sim, reactor } = setup(0);
    sim.world.get(reactor, ModuleC)!.fuel = 0;
    run(sim, 60);
    expect(refuelJobs(sim)).toBe(0);
  });
});
