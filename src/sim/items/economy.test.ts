import { describe, expect, it } from 'vitest';

import {
  CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';

import type { SimEvent } from '../events';
import { spawnModule } from '../modules/spawn';

import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';

import { stampShip } from '../combat/ships';

import type { ShipTemplate } from '../registry';

import { Struct } from '../structure';

import { CarryingC, ItemStackC } from './components';

import { needsMaterials } from './materials';

import { stackAt } from './stacks';

import { storageAdd, storageCount } from './storage';

import { totalStock } from './stock';

import { shipGrid } from '../regions';


/** A fixture ship: the template stamped at the sector origin as an inert ship (a prize is skipped by every ship system). It is the first entity, so its id is 1. */
function fixtureShip(sim: Sim, t: ShipTemplate): number {
  return stampShip(sim, t, { faction: 'player', state: 'prize', x: 0, y: 0 });
}

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const item = (stackSize: number) => ({ name: 'i', tags: [], stackSize });
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, carryCapacity: 20 } },
  modules: {
    storage: mod({ solid: true, access: [0, 1], storage: { capacity: 4 } }),
    crate: mod({ solid: true, cost: [{ item: 'metal', count: 6 }] }),
  },
  crewNames: [],
  items: { scrap: item(100), metal: item(100), ice: item(50) },
  recipes: {},
  structCosts: { wall: [{ item: 'metal', count: 2 }] },
};
const rows = ['##############', '#____________#', '#____________#', '#____________#', '#____________#', '##############'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, cooking: v, patrol: v,
});

function make(): Sim {
  const sim = new Sim(5, content);
  fixtureShip(sim, { name: 't', rows });
  return sim;
}
function crew(sim: Sim, x: number, y: number, prio: Priorities): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...prio });
  sim.world.add(id, NeedsC, { rest: 100 });
  return id;
}
const storage = (sim: Sim, x: number, y: number, stock: [string, number][] = []): number => {
  const id = spawnModule(sim, 'storage', x, y, 0);
  for (const [i, n] of stock) storageAdd(sim, id, i, n);
  return id;
};
const run = (sim: Sim, n: number, events: SimEvent[] = []): SimEvent[] => {
  for (let i = 0; i < n; i++) {
    sim.step();
    events.push(...sim.events.drain());
  }
  return events;
};
const spawnItems = (sim: Sim, x: number, y: number, it: string, count: number): void =>
  sim.enqueue({ type: 'debug.spawnItems', ship: 1, x, y, item: it, count });
const wall = (sim: Sim, x: number, y: number): void => sim.enqueue({ type: 'job.build', ship: 1, x, y, struct: Struct.Wall });
const struct = (sim: Sim, x: number, y: number): number => shipGrid(sim, 1)?.get('struct', x, y) as number;
const hauler = { ...all(4), hauling: 1 };
const builder = { ...all(4), construction: 1 };

describe('hauling', () => {
  it('moves a loose stack into storage', () => {
    const sim = make();
    const s = storage(sim, 10, 1);
    crew(sim, 3, 3, hauler);
    spawnItems(sim, 2, 2, 'scrap', 10);
    const events = run(sim, 400);
    expect(storageCount(sim, s, 'scrap')).toBe(10);
    expect(sim.world.query(ItemStackC)).toHaveLength(0);
    expect(events.some((e) => e.type === 'item.hauled' && e.to === 'storage')).toBe(true);
  });

  it('respects storage filters', () => {
    const sim = make();
    const near = storage(sim, 3, 1);
    const far = storage(sim, 11, 1);
    sim.enqueue({ type: 'storage.setFilter', moduleId: near, items: ['ice'] });
    crew(sim, 4, 3, hauler);
    spawnItems(sim, 3, 3, 'scrap', 8);
    run(sim, 500);
    expect(storageCount(sim, near, 'scrap')).toBe(0);
    expect(storageCount(sim, far, 'scrap')).toBe(8);
  });

  it('warns storage.full (debounced) when nothing accepts the stack', () => {
    const sim = make();
    const s = storage(sim, 10, 1);
    sim.enqueue({ type: 'storage.setFilter', moduleId: s, items: ['ice'] });
    spawnItems(sim, 2, 2, 'scrap', 5);
    const events = run(sim, 300);
    expect(events.filter((e) => e.type === 'storage.full')).toHaveLength(1);
  });

  it('never carries more than the carry capacity and finishes in several trips', () => {
    const sim = make();
    const s = storage(sim, 10, 1);
    const id = crew(sim, 3, 3, hauler);
    spawnItems(sim, 2, 2, 'scrap', 50);
    let peak = 0;
    for (let i = 0; i < 1500; i++) {
      sim.step();
      peak = Math.max(peak, sim.world.get(id, CarryingC)?.count ?? 0);
    }
    expect(peak).toBe(20);
    expect(storageCount(sim, s, 'scrap')).toBe(50);
  });

  it('reserves stock: two crew and two jobs never claim more than the stack holds', () => {
    const sim = make();
    crew(sim, 3, 3, builder);
    crew(sim, 4, 3, builder);
    spawnItems(sim, 2, 2, 'metal', 3);
    wall(sim, 6, 1);
    wall(sim, 7, 1);
    for (let i = 0; i < 300; i++) {
      sim.step();
      const claimed = sim.world.query(JobC)
        .map((j) => sim.world.get(j, JobC)?.haul)
        .filter((h) => h?.phase === 'pickup')
        .reduce((n, h) => n + (h?.count ?? 0), 0);
      const onFloor = sim.world.query(ItemStackC).reduce((n, st) => n + (sim.world.get(st, ItemStackC)?.count ?? 0), 0);
      expect(claimed).toBeLessThanOrEqual(onFloor);
    }
    expect(totalStock(sim, 'metal') + sim.world.query(JobC).length).toBeGreaterThan(0);
  });
});

describe('construction materials', () => {
  it('delivers 2 metal from storage and only starts work after delivery', () => {
    const sim = make();
    const s = storage(sim, 10, 1, [['metal', 10]]);
    crew(sim, 3, 3, builder);
    wall(sim, 6, 1);
    let started = false;
    let violation = false;
    for (let i = 0; i < 800 && struct(sim, 6, 1) !== Struct.Wall; i++) {
      sim.step();
      for (const j of sim.world.query(JobC)) {
        const job = sim.world.get(j, JobC);
        if (job?.kind === 'build' && job.progress > 0) {
          started = true;
          if (needsMaterials(job)) violation = true;
        }
      }
    }
    expect(struct(sim, 6, 1)).toBe(Struct.Wall);
    expect(started && !violation).toBe(true);
    expect(storageCount(sim, s, 'metal')).toBe(8);
  });

  it('waits with a debounced missingMaterials event, then proceeds once metal appears', () => {
    const sim = make();
    crew(sim, 3, 3, builder);
    wall(sim, 6, 1);
    const events = run(sim, 300);
    expect(struct(sim, 6, 1)).toBe(Struct.Floor);
    expect(events.filter((e) => e.type === 'job.missingMaterials')).toHaveLength(1);
    spawnItems(sim, 2, 2, 'metal', 2);
    run(sim, 600, events);
    expect(struct(sim, 6, 1)).toBe(Struct.Wall);
  });

  it('cancelling a job drops what was delivered as floor stacks', () => {
    const sim = make();
    storage(sim, 10, 1, [['metal', 10]]);
    crew(sim, 3, 3, builder);
    wall(sim, 6, 2);
    for (let i = 0; i < 800; i++) {
      sim.step();
      const job = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)).find((j) => j?.kind === 'build');
      if (job && job.delivered?.length) break;
    }
    sim.enqueue({ type: 'job.cancel', ship: 1, x: 6, y: 2 });
    run(sim, 1);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.kind === 'build')).toHaveLength(0);
    const floor = sim.world.query(ItemStackC).map((s) => sim.world.get(s, ItemStackC)).filter((s) => s?.item === 'metal');
    expect(floor.reduce((n, s) => n + (s?.count ?? 0), 0)).toBe(2);
    expect(struct(sim, 6, 2)).toBe(Struct.Floor);
  });

  it('refunds half the cost (rounded down) when deconstructing a wall or a module', () => {
    const sim = make();
    crew(sim, 3, 3, builder);
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 6, y: 2, kind: Struct.Wall });
    sim.enqueue({ type: 'job.deconstruct', ship: 1, x: 6, y: 2 });
    run(sim, 300);
    expect(struct(sim, 6, 2)).toBe(Struct.Floor);
    const wallRefund = sim.world.get(stackAt(sim, 1, 6, 2), ItemStackC);
    expect(wallRefund).toMatchObject({ item: 'metal', count: 1 });

    spawnModule(sim, 'crate', 9, 3, 0);
    sim.enqueue({ type: 'job.deconstructModule', ship: 1, x: 9, y: 3 });
    run(sim, 300);
    expect(stackAt(sim, 1, 9, 3)).not.toBe(0);
    expect(sim.world.get(stackAt(sim, 1, 9, 3), ItemStackC)).toMatchObject({ item: 'metal', count: 3 });
  });
});
