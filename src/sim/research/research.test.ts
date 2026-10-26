import { describe, expect, it } from 'vitest';

import { CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { stampShip } from '../combat/ships';
import type { SimEvent } from '../events';
import { ItemStackC } from '../items/components';
import { storageAdd, storageCount } from '../items/storage';
import { isKnown } from '../modules/blueprints';
import { spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef, ResearchDef, ShipTemplate } from '../registry';
import { deserialize, serialize } from '../save';
import { Sim } from '../sim';
import { ResearchC } from './components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const tier = { tier: 2, minDanger: 3, price: 100 };
const prio = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});
const project = (o: Partial<ResearchDef> = {}): ResearchDef => ({ name: 'P', category: 'x', cost: [{ item: 'chip', count: 4 }], work: 200, unlocks: ['a.mk2'], ...o });
const content: ContentRegistry = {
  ships: {},
  roles: {
    'role.plain': { name: 'Plain', priorities: prio(4) },
    'role.sci': { name: 'Sci', priorities: prio(4), skills: { science: 5 } },
  },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, carryCapacity: 20 } },
  modules: {
    storage: mod({ solid: true, access: [0, 1], storage: { capacity: 4 } }),
    lab: mod({ solid: true, access: [0, 1], power: -2, research: true, workstation: true }),
    reactor: mod({ power: 20 }),
    'a.mk2': mod({ blueprint: tier }),
    'a.mk3': mod({ blueprint: { ...tier, tier: 3 } }),
    'b.mk2': mod({ blueprint: tier }),
    'c.mk2': mod({ blueprint: tier }),
  },
  crewNames: [],
  items: { chip: { name: 'Chip', tags: [], stackSize: 50 }, gem: { name: 'Gem', tags: [], stackSize: 50 } },
  recipes: {},
  structCosts: {},
  research: {
    'r.a2': project(),
    'r.a3': project({ unlocks: ['a.mk3'], requires: ['a.mk2'], cost: [{ item: 'chip', count: 4 }, { item: 'gem', count: 2 }] }),
    'r.b2': project({ unlocks: ['b.mk2'] }),
    'r.c2': project({ unlocks: ['c.mk2'] }),
  },
};
const rows = ['##############', '#____________#', '#____________#', '#____________#', '#____________#', '##############'];

interface Opts { labs?: number; crew?: string[]; chips?: number; gems?: number; work?: number }
function setup(o: Opts = {}) {
  const c = o.work ? { ...content, research: { ...content.research, 'r.a2': project({ work: o.work }) } } : content;
  const sim = new Sim(5, c);
  const ship = stampShip(sim, { name: 't', rows } satisfies ShipTemplate, { faction: 'player', state: 'prize', x: 0, y: 0 });
  spawnModule(sim, 'reactor', 12, 4, 0);
  const labs = Array.from({ length: o.labs ?? 1 }, (_, i) => spawnModule(sim, 'lab', 2 + i * 3, 1, 0));
  const store = spawnModule(sim, 'storage', 9, 1, 0);
  storageAdd(sim, store, 'chip', o.chips ?? 10);
  storageAdd(sim, store, 'gem', o.gems ?? 0);
  (o.crew ?? ['role.plain']).forEach((role, i) => {
    const id = sim.world.createEntity();
    sim.world.add(id, CrewC, { name: 'T', role, species: 'species.human', appearanceSeed: 1, activity: 'idle' });
    sim.world.add(id, PositionC, { x: 5 + i, y: 3, toX: 5 + i, toY: 3, progress: 0, facing: 0 });
    sim.world.add(id, PathC, { steps: [] });
    sim.world.add(id, PrioritiesC, { ...prio(4), research: 1 });
    sim.world.add(id, NeedsC, { rest: 100 });
  });
  return { sim, ship, labs, store };
}
const run = (sim: Sim, n: number): SimEvent[] => {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    events.push(...sim.events.drain());
  }
  return events;
};
const rejects = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));
const queue = (sim: Sim, ship: number): string[] => sim.world.get(ship, ResearchC)?.queue ?? [];
const progress = (sim: Sim, ship: number): number => sim.world.get(ship, ResearchC)?.progress ?? 0;

describe('research gating', () => {
  it('refuses bad, locked, known, duplicate and lab-less queueing', () => {
    const { sim, ship } = setup();
    for (const project of ['r.nope', 'r.a3', 'r.a2', 'r.a2']) sim.enqueue({ type: 'research.queue', ship, project });
    expect(rejects(run(sim, 1))).toEqual(['badProject', 'locked', 'queued']);
    expect(queue(sim, ship)).toEqual(['r.a2']);
    sim.story.blueprints.push('b.mk2');
    sim.enqueue({ type: 'research.queue', ship, project: 'r.b2' });
    expect(rejects(run(sim, 1))).toEqual(['alreadyKnown']);
    const bare = setup({ labs: 0 });
    bare.sim.enqueue({ type: 'research.queue', ship: bare.ship, project: 'r.a2' });
    expect(rejects(run(bare.sim, 1))).toEqual(['noLab']);
  });

  it('opens the Mk III project once Mk II is known', () => {
    const { sim, ship } = setup();
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    expect(rejects(run(sim, 1))).toEqual(['locked']);
    sim.story.blueprints.push('a.mk2');
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    expect(rejects(run(sim, 1))).toEqual([]);
    expect(queue(sim, ship)).toEqual(['r.a3']);
  });
});

describe('chained research', () => {
  it('queues Mk III straight behind a queued Mk II, but never starts it before Mk II is known', () => {
    const { sim, ship } = setup({ work: 100, gems: 2, chips: 12 });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    expect(rejects(run(sim, 1))).toEqual(['locked']);
    expect(queue(sim, ship)).toEqual(['r.a2', 'r.a3']);
    let startedEarly = false;
    for (let i = 0; i < 700 && !isKnown(sim, 'a.mk3'); i++) {
      run(sim, 1);
      if (sim.world.get(ship, ResearchC)?.paid && queue(sim, ship)[0] === 'r.a3' && !isKnown(sim, 'a.mk2')) startedEarly = true;
    }
    expect(startedEarly).toBe(false);
    expect(isKnown(sim, 'a.mk2')).toBe(true);
    expect(isKnown(sim, 'a.mk3')).toBe(true);
  });

  it('refuses to move a project ahead of its prerequisite, and cancelling Mk II drops Mk III', () => {
    const { sim, ship } = setup({ crew: [], chips: 0 });
    for (const project of ['r.a2', 'r.a3', 'r.b2']) sim.enqueue({ type: 'research.queue', ship, project });
    sim.enqueue({ type: 'research.move', ship, project: 'r.a3', to: 0 });
    sim.enqueue({ type: 'research.move', ship, project: 'r.a2', to: 2 });
    expect(rejects(run(sim, 1))).toEqual(['order', 'order']);
    sim.enqueue({ type: 'research.move', ship, project: 'r.b2', to: 0 });
    run(sim, 1);
    expect(queue(sim, ship)).toEqual(['r.b2', 'r.a2', 'r.a3']);
    sim.enqueue({ type: 'research.cancel', ship, project: 'r.a2' });
    run(sim, 1);
    expect(queue(sim, ship)).toEqual(['r.b2']);
  });
});

describe('research queue', () => {
  it('reorders waiting projects and cancels; the paid active one keeps place 0', () => {
    const { sim, ship, store } = setup({ chips: 4, crew: [] });
    for (const project of ['r.b2', 'r.a2', 'r.c2']) sim.enqueue({ type: 'research.queue', ship, project });
    run(sim, 11);
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(true);
    expect(storageCount(sim, store, 'chip')).toBe(0);
    sim.enqueue({ type: 'research.move', ship, project: 'r.c2', to: 0 });
    sim.enqueue({ type: 'research.move', ship, project: 'r.b2', to: 1 });
    sim.enqueue({ type: 'research.move', ship, project: 'r.zz', to: 1 });
    expect(rejects(run(sim, 1))).toEqual(['active', 'active', 'notQueued']);
    expect(queue(sim, ship)).toEqual(['r.b2', 'r.a2', 'r.c2']);
    sim.enqueue({ type: 'research.move', ship, project: 'r.c2', to: 1 });
    run(sim, 1);
    expect(queue(sim, ship)).toEqual(['r.b2', 'r.c2', 'r.a2']);
    sim.enqueue({ type: 'research.cancel', ship, project: 'r.c2' });
    sim.enqueue({ type: 'research.cancel', ship, project: 'r.c2' });
    expect(rejects(run(sim, 1))).toEqual(['notQueued']);
    expect(queue(sim, ship)).toEqual(['r.b2', 'r.a2']);
  });
});

describe('research materials', () => {
  it('does not start on materials a pending haul has already claimed', () => {
    const { sim, ship, store } = setup({ chips: 6, crew: [] });
    // A haul takes 3 chips from the storage for a build: only 3 are free, the project needs 4.
    const other = spawnModule(sim, 'storage', 11, 1, 0);
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'hauling', kind: 'haul', x: 9, y: 1, struct: 0, work: 1, progress: 0, reservedBy: 0,
      haul: { item: 'chip', count: 3, phase: 'pickup', src: { kind: 'storage', id: store }, dst: { kind: 'storage', id: other } },
    });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    run(sim, 30);
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(false);
    expect(storageCount(sim, store, 'chip')).toBe(6);
    sim.world.destroyEntity(job);
    run(sim, 11);
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(true);
    expect(storageCount(sim, store, 'chip')).toBe(2);
  });

  it('cancelling a fully paid project refunds exactly what was paid', () => {
    const { sim, ship, store } = setup({ chips: 4, crew: [] });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    run(sim, 11);
    expect(storageCount(sim, store, 'chip')).toBe(0);
    sim.enqueue({ type: 'research.cancel', ship, project: 'r.a2' });
    run(sim, 1);
    const floor = sim.world.query(ItemStackC).reduce((n, id) => n + (sim.world.get(id, ItemStackC)?.count ?? 0), 0);
    expect(floor).toBe(4);
  });

  it('waits for the whole cost, then takes it from stock when the project starts', () => {
    const { sim, ship, store } = setup({ chips: 4, gems: 1, crew: [] });
    sim.story.blueprints.push('a.mk2');
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    run(sim, 30);
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(false);
    expect(storageCount(sim, store, 'chip')).toBe(4);
    expect(sim.world.query(JobC)).toHaveLength(0);
    storageAdd(sim, store, 'gem', 1);
    run(sim, 11);
    expect(sim.world.get(ship, ResearchC)?.paid).toBe(true);
    expect(storageCount(sim, store, 'chip')).toBe(0);
    expect(storageCount(sim, store, 'gem')).toBe(0);
  });

  it('refunds a cancelled active project to the floor', () => {
    const { sim, ship, store } = setup({ chips: 6, crew: [] });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    run(sim, 11);
    expect(storageCount(sim, store, 'chip')).toBe(2);
    sim.enqueue({ type: 'research.cancel', ship, project: 'r.a2' });
    run(sim, 20);
    expect(sim.world.get(ship, ResearchC)).toMatchObject({ queue: [], paid: false, progress: 0 });
    const floor = sim.world.query(ItemStackC).reduce((n, id) => n + (sim.world.get(id, ItemStackC)?.count ?? 0), 0);
    expect(floor).toBe(4);
    expect(sim.world.query(JobC).filter((j) => sim.world.get(j, JobC)?.kind === 'research')).toHaveLength(0);
  });
});

describe('research work', () => {
  it('is a crew job: no crew, no progress; a worker brings it in', () => {
    const idle = setup({ crew: [] });
    idle.sim.enqueue({ type: 'research.queue', ship: idle.ship, project: 'r.a2' });
    run(idle.sim, 200);
    expect(progress(idle.sim, idle.ship)).toBe(0);
    const jobs = idle.sim.world.query(JobC).map((j) => idle.sim.world.get(j, JobC));
    expect(jobs.map((j) => [j?.kind, j?.category])).toEqual([['research', 'research']]);

    const { sim, ship } = setup();
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    run(sim, 100);
    expect(progress(sim, ship)).toBeGreaterThan(20);
  });

  it('finishing learns the unlocked blueprints, announces it and frees the crew', () => {
    const { sim, ship } = setup({ work: 100 });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    expect(isKnown(sim, 'a.mk2')).toBe(false);
    const events = run(sim, 400);
    expect(isKnown(sim, 'a.mk2')).toBe(true);
    expect(sim.story.blueprints).toContain('a.mk2');
    expect(events.filter((e) => e.type === 'research.done')).toEqual([{ type: 'research.done', ship, project: 'r.a2' }]);
    expect(queue(sim, ship)).toEqual([]);
    expect(sim.world.query(JobC)).toHaveLength(0);
    // The next project in line can now be queued.
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a3' });
    expect(rejects(run(sim, 1))).toEqual([]);
  });

  it('science speeds it up as SKILL_STEP per level', () => {
    const a = setup({ crew: ['role.plain'] });
    const b = setup({ crew: ['role.sci'] });
    for (const s of [a, b]) s.sim.enqueue({ type: 'research.queue', ship: s.ship, project: 'r.a2' });
    run(a.sim, 120);
    run(b.sim, 120);
    expect(progress(a.sim, a.ship)).toBeGreaterThan(20);
    expect(progress(b.sim, b.ship) / progress(a.sim, a.ship)).toBeCloseTo(1.5, 1);
  });

  it('a second module speeds the one active project up instead of running another', () => {
    const one = setup({ labs: 1, crew: ['role.plain', 'role.plain'] });
    const two = setup({ labs: 2, crew: ['role.plain', 'role.plain'] });
    for (const s of [one, two]) {
      s.sim.enqueue({ type: 'research.queue', ship: s.ship, project: 'r.a2' });
      s.sim.enqueue({ type: 'research.queue', ship: s.ship, project: 'r.b2' });
    }
    run(one.sim, 120);
    run(two.sim, 120);
    expect(queue(two.sim, two.ship)).toEqual(['r.a2', 'r.b2']);
    expect(progress(two.sim, two.ship) / progress(one.sim, one.ship)).toBeCloseTo(2, 0);
    expect(two.sim.world.query(JobC)).toHaveLength(2);
  });

  it('survives a save and load mid-project, then finishes', () => {
    const { sim, ship } = setup({ work: 300 });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.a2' });
    sim.enqueue({ type: 'research.queue', ship, project: 'r.b2' });
    run(sim, 100);
    const before = sim.world.get(ship, ResearchC);
    expect(before?.paid).toBe(true);
    expect(before?.progress).toBeGreaterThan(0);
    const copy = deserialize(serialize(sim), sim.content);
    expect(copy.world.get(ship, ResearchC)).toEqual(before);
    run(copy, 600);
    expect(isKnown(copy, 'a.mk2')).toBe(true);
    expect(queue(copy, ship)).toEqual(['r.b2']);
  });
});
