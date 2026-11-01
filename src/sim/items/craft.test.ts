import { describe, expect, it } from 'vitest';

import { CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';

import type { SimEvent } from '../events';
import { spawnModule } from '../modules/spawn';

import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';

import { stampShip } from '../combat/ships';

import type { ShipTemplate } from '../registry';

import { ItemStackC, ProductionC } from './components';

import { storageAdd, storageCount } from './storage';

import { totalStock } from './stock';


/** A fixture ship: the template stamped at the sector origin as an inert ship (a prize is skipped by every ship system). It is the first entity, so its id is 1. */
function fixtureShip(sim: Sim, t: ShipTemplate): number {
  return stampShip(sim, t, { faction: 'player', state: 'prize', x: 0, y: 0 });
}

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const item = (stackSize: number, flammability?: number) => ({ name: 'i', tags: [], stackSize, ...(flammability ? { flammability } : {}) });
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, carryCapacity: 20 } },
  modules: {
    storage: mod({ solid: true, access: [0, 1], storage: { capacity: 4 } }),
    fab: mod({ footprint: [2, 1], solid: true, access: [0, 1], power: -4, crafting: true, workstation: true }),
    reactor: mod({ power: 20 }),
  },
  crewNames: [],
  items: { scrap: item(100), metal: item(100), gem: item(100), poly: item(50, 0.8) },
  recipes: {
    metal: { name: 'Metal', station: 'fab', inputs: [{ item: 'scrap', count: 2 }], outputs: [{ item: 'metal', count: 1 }], work: 20 },
    refine: { name: 'Refine', station: 'fab', inputs: [{ item: 'scrap', count: 2 }], outputs: [{ item: 'metal', count: 1 }], work: 20, category: 'refining' },
    sure: { name: 'Sure', station: 'fab', inputs: [{ item: 'scrap', count: 2 }], outputs: [{ item: 'metal', count: 1 }], extras: [{ item: 'gem', count: 2, chance: 1 }], work: 20 },
    never: { name: 'Never', station: 'fab', inputs: [{ item: 'scrap', count: 2 }], outputs: [{ item: 'metal', count: 1 }], extras: [{ item: 'gem', count: 2, chance: 0 }], work: 20 },
    maybe: { name: 'Maybe', station: 'fab', inputs: [{ item: 'scrap', count: 1 }], outputs: [{ item: 'metal', count: 1 }], extras: [{ item: 'gem', count: 1, chance: 0.5 }], work: 5 },
    other: { name: 'Other', station: 'nope', inputs: [], outputs: [], work: 20 },
  },
  structCosts: {},
};
const rows = ['##############', '#____________#', '#____________#', '#____________#', '#____________#', '##############'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});

function setup(scrap: number, prio: Partial<Priorities> = { crafting: 1, refining: 1 }): { sim: Sim; fab: number; store: number; out: number } {
  const sim = new Sim(5, content);
  fixtureShip(sim, { name: 't', rows });
  spawnModule(sim, 'reactor', 12, 4, 0);
  const fab = spawnModule(sim, 'fab', 3, 1, 0);
  const store = spawnModule(sim, 'storage', 9, 1, 0);
  const out = spawnModule(sim, 'storage', 11, 1, 0);
  storageAdd(sim, store, 'scrap', scrap);
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x: 5, y: 3, toX: 5, toY: 3, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all(4), hauling: 1, ...prio });
  sim.world.add(id, NeedsC, { rest: 100 });
  return { sim, fab, store, out };
}
const jobCategories = (sim: Sim): string[] => sim.world.query(JobC).map((j) => sim.world.get(j, JobC)).filter((j) => j?.kind === 'craft').map((j) => j?.category ?? '');
const run = (sim: Sim, n: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    events.push(...sim.events.drain());
  }
  return events;
};
const order = (sim: Sim, fab: number, mode: 'count' | 'keep', target: number): void =>
  sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'metal', mode, target });
const metalInStorage = (sim: Sim, ...ids: number[]): number => ids.reduce((n, id) => n + storageCount(sim, id, 'metal'), 0);

describe('crafting', () => {
  it("a 'count' order makes N metal from scrap: fetch, craft, output, haul", () => {
    const { sim, fab, store, out } = setup(20);
    order(sim, fab, 'count', 3);
    const events = run(sim, 1500);
    expect(sim.world.get(fab, ProductionC)?.orders[0]).toMatchObject({ done: 3, target: 3 });
    expect(events.filter((e) => e.type === 'production.done')).toHaveLength(3);
    expect(metalInStorage(sim, store, out)).toBe(3);
    expect(storageCount(sim, store, 'scrap')).toBe(14);
    expect(sim.world.query(ItemStackC)).toHaveLength(0);
  });

  it("a 'keep' order stops at its target", () => {
    const { sim, fab, store, out } = setup(30);
    storageAdd(sim, out, 'metal', 2);
    order(sim, fab, 'keep', 5);
    run(sim, 2500);
    expect(totalStock(sim, 'metal')).toBe(5);
    expect(metalInStorage(sim, store, out)).toBe(5);
    expect(storageCount(sim, store, 'scrap')).toBe(24);
  });

  it('does not craft while the station is unpowered, and runs orders in list order', () => {
    const { sim, fab, store, out } = setup(20);
    sim.enqueue({ type: 'module.setEnabled', id: fab, enabled: false });
    order(sim, fab, 'count', 2);
    run(sim, 600);
    expect(metalInStorage(sim, store, out)).toBe(0);
    sim.enqueue({ type: 'module.setEnabled', id: fab, enabled: true });
    run(sim, 1200);
    expect(metalInStorage(sim, store, out)).toBe(2);
  });

  it('validates production and storage commands', () => {
    const { sim, fab, store } = setup(0);
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'other', mode: 'count', target: 1 });
    sim.enqueue({ type: 'production.add', moduleId: store, recipe: 'metal', mode: 'count', target: 1 });
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'metal', mode: 'count', target: 0 });
    sim.enqueue({ type: 'storage.setFilter', moduleId: store, items: ['ghost'] });
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'metal', mode: 'count', target: 1 });
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'metal', mode: 'keep', target: 4 });
    sim.enqueue({ type: 'production.reorder', moduleId: fab, from: 1, to: 0 });
    const events = run(sim, 1);
    expect(events.filter((e) => e.type === 'command.rejected')).toHaveLength(4);
    expect(sim.world.get(fab, ProductionC)?.orders.map((o) => o.mode)).toEqual(['keep', 'count']);
    sim.enqueue({ type: 'production.remove', moduleId: fab, index: 0 });
    run(sim, 1);
    expect(sim.world.get(fab, ProductionC)?.orders).toHaveLength(1);
  });
});

describe('keep orders count only our own stock', () => {
  it("a station's crates do not satisfy a keep order, so the fab still prints", () => {
    const { sim, fab, store, out } = setup(30);
    const other = stampShip(sim, { name: 'station', rows }, { faction: 'neutral', state: 'prize', x: 40, y: 0 });
    const crate = spawnModule(sim, 'storage', 49, 1, 0);
    expect(crate).toBeGreaterThan(0);
    expect(other).toBeGreaterThan(0);
    storageAdd(sim, crate, 'metal', 10);
    expect(totalStock(sim, 'metal')).toBe(0);
    order(sim, fab, 'keep', 3);
    run(sim, 1500);
    expect(metalInStorage(sim, store, out)).toBe(3);
    expect(totalStock(sim, 'metal')).toBe(3);
  });
});

describe('work categories', () => {
  const refineOrder = (sim: Sim, fab: number) => sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'refine', mode: 'count', target: 1 });

  it("a recipe's category sets its craft job's category (default crafting)", () => {
    const { sim, fab } = setup(20);
    order(sim, fab, 'count', 1);
    run(sim, 40);
    expect(jobCategories(sim)).toEqual(['crafting']);
    const r = setup(20);
    refineOrder(r.sim, r.fab);
    run(r.sim, 40);
    expect(jobCategories(r.sim)).toEqual(['refining']);
  });

  it('crew only take refining work with refining on, and crafting work with crafting on', () => {
    const noRefine = setup(20, { crafting: 1, refining: 0 });
    refineOrder(noRefine.sim, noRefine.fab);
    run(noRefine.sim, 600);
    expect(metalInStorage(noRefine.sim, noRefine.store, noRefine.out)).toBe(0);
    const noCraft = setup(20, { crafting: 0, refining: 1 });
    order(noCraft.sim, noCraft.fab, 'count', 1);
    run(noCraft.sim, 600);
    expect(metalInStorage(noCraft.sim, noCraft.store, noCraft.out)).toBe(0);
    const both = setup(20, { crafting: 0, refining: 1 });
    refineOrder(both.sim, both.fab);
    run(both.sim, 600);
    expect(metalInStorage(both.sim, both.store, both.out)).toBe(1);
  });
});

describe('production.edit', () => {
  it('changes mode and target in place, keeping batches done, and rejects bad input', () => {
    const { sim, fab } = setup(0);
    sim.enqueue({ type: 'production.add', moduleId: fab, recipe: 'metal', mode: 'count', target: 3 });
    run(sim, 1);
    const order = sim.world.get(fab, ProductionC)?.orders[0];
    if (order) order.done = 2;
    sim.enqueue({ type: 'production.edit', moduleId: fab, index: 0, target: 5 });
    sim.enqueue({ type: 'production.edit', moduleId: fab, index: 0, mode: 'keep' });
    sim.enqueue({ type: 'production.edit', moduleId: fab, index: 1, target: 5 });
    sim.enqueue({ type: 'production.edit', moduleId: fab, index: 0, target: 0 });
    const events = run(sim, 1);
    expect(sim.world.get(fab, ProductionC)?.orders[0]).toEqual({ recipe: 'metal', mode: 'keep', target: 5, done: 2 });
    expect(events.filter((e) => e.type === 'command.rejected')).toHaveLength(2);
  });
});

describe('fire and items', () => {
  it('a flammable stack on a burning tile burns away, a non-flammable one does not', () => {
    const { sim } = setup(0);
    sim.enqueue({ type: 'debug.spawnItems', ship: 1, x: 6, y: 4, item: 'poly', count: 30 });
    sim.enqueue({ type: 'debug.spawnItems', ship: 1, x: 7, y: 4, item: 'scrap', count: 30 });
    run(sim, 1);
    sim.enqueue({ type: 'debug.setField', ship: 1, x: 6, y: 4, field: 'fire', value: 255 });
    sim.enqueue({ type: 'debug.setField', ship: 1, x: 7, y: 4, field: 'fire', value: 255 });
    run(sim, 40);
    expect(totalStock(sim, 'poly')).toBeLessThan(30);
    expect(totalStock(sim, 'scrap')).toBe(30);
  });

  it('rolls a recipe\'s rare extras per batch: chance 1 always drops, chance 0 never', () => {
    const a = setup(20);
    a.sim.enqueue({ type: 'production.add', moduleId: a.fab, recipe: 'sure', mode: 'count', target: 2 });
    run(a.sim, 1200);
    expect(totalStock(a.sim, 'gem')).toBe(4);
    const b = setup(20);
    b.sim.enqueue({ type: 'production.add', moduleId: b.fab, recipe: 'never', mode: 'count', target: 2 });
    run(b.sim, 1200);
    expect(totalStock(b.sim, 'gem')).toBe(0);
    expect(totalStock(b.sim, 'metal')).toBe(2);
  });

  it('a middling extra chance rolls from the seeded rng: same seed, same drops, and some of each', () => {
    const go = (): number => {
      const r = setup(20);
      r.sim.enqueue({ type: 'production.add', moduleId: r.fab, recipe: 'maybe', mode: 'count', target: 12 });
      run(r.sim, 3000);
      return totalStock(r.sim, 'gem');
    };
    const first = go();
    expect(go()).toBe(first);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(12);
  });
});
