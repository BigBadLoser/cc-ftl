import { describe, expect, it } from 'vitest';
import { CrewC, DraftedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { findPath } from '../crew/pathfind';
import type { SimEvent } from '../events';
import { ModuleC } from '../modules/components';
import { spawnModule, removeModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { deserialize, migrate, serialize } from '../save';
import { gridFromTemplate } from '../ship';
import { Sim } from '../sim';
import { Struct } from '../structure';
import { CREW_MAX_HP } from '../tuning';
import { AirlockC, CrossingC as CrossingKey, PortalC } from './components';
import { airlockTiles } from './airlock';
import { cachedPath } from './pathCache';
import { planRoute } from './route';

const airlockDef: ModuleDef = {
  name: 'Airlock', asset: 'a', footprint: [1, 4], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20,
  hullEdge: 'n', airlock: { cycleSec: 2 },
};
const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: { airlock: airlockDef, powered: { ...airlockDef, power: -5, airlock: undefined, hullEdge: undefined, footprint: [1, 1] } },
};
// Hull wall at (4,1) with Space beyond; the airlock fills (4,1)-(4,4); the room is below.
const SHIP = [
  '.........', '....#....', '...#_#...', '...#_#...', '.###_###.', '.#_____#.', '.#_____#.', '.#######.',
];
const LEFT = { gridId: 1, x: 4, y: 1 };
const RIGHT = { gridId: 2, x: 4, y: 1 };
const all4: Priorities = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 4, hauling: 4, crafting: 4, cooking: 4 };

function world(grids = 2): Sim {
  const sim = new Sim(5, content);
  for (let g = 1; g <= grids; g++) {
    sim.grids.set(g, gridFromTemplate(g, { name: `s${g}`, rows: SHIP }));
    spawnModule(sim, g, 'airlock', 4, 1, 0);
  }
  return sim;
}
function crew(sim: Sim, gridId: number, x: number, y: number, suit = true): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all4 });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  if (suit) sim.enqueue({ type: 'suit.set', crew: id, worn: true });
  return id;
}
const link = (sim: Sim, extra: object = {}): void =>
  sim.enqueue({ type: 'portal.link', kind: 'airlock', a: LEFT, b: RIGHT, requires: [{ type: 'suit' }], ...extra } as never);
const portalIds = (sim: Sim): readonly number[] => sim.world.query(PortalC);
const airlocks = (sim: Sim): number[] => [...sim.world.query(AirlockC)];

/** Run n ticks, collecting events and asserting the interlock (inner and outer never open together). */
function run(sim: Sim, n: number, events: SimEvent[] = []): SimEvent[] {
  for (let i = 0; i < n; i++) {
    sim.step();
    events.push(...sim.events.drain());
    for (const id of airlocks(sim)) {
      const m = sim.world.get(id, ModuleC)!;
      const t = airlockTiles(airlockDef, m);
      const g = sim.grids.get(m.gridId)!;
      expect(g.get('door', t.inner.x, t.inner.y) === 255 && g.get('door', t.outer.x, t.outer.y) === 255).toBe(false);
    }
  }
  return events;
}
function totalO2(sim: Sim, gridId: number): number {
  return [...sim.grids.get(gridId)!.raw('o2')].reduce((a, b) => a + b, 0);
}
function journey(sim: Sim): number {
  const c = crew(sim, 1, 3, 6);
  link(sim);
  run(sim, 2);
  sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
  sim.enqueue({ type: 'crew.moveTo', id: c, x: 5, y: 6, gridId: 2 });
  return c;
}

describe('airlock module', () => {
  it('turns its footprint into doors and a chamber, and back when removed', () => {
    const sim = world(1);
    const g = sim.grids.get(1)!;
    expect([1, 2, 3, 4].map((y) => g.get('struct', 4, y))).toEqual([Struct.Door, Struct.Floor, Struct.Floor, Struct.Door]);
    removeModule(sim, airlocks(sim)[0]!);
    expect(g.get('struct', 4, 1)).toBe(Struct.Wall);
    expect(g.get('struct', 4, 4)).toBe(Struct.Floor);
  });

  it('cycles out and back without venting the ship', () => {
    const sim = world(1);
    const before = totalO2(sim, 1);
    const id = airlocks(sim)[0]!;
    run(sim, 3);
    sim.enqueue({ type: 'airlock.cycle', moduleId: id, to: 'outer' });
    run(sim, 30); // mid-cycle: both doors shut
    expect(sim.world.get(id, AirlockC)!.state).toBe('toOuter');
    run(sim, 20);
    expect(sim.world.get(id, AirlockC)!.state).toBe('outer');
    const t = airlockTiles(airlockDef, sim.world.get(id, ModuleC)!);
    expect(sim.grids.get(1)!.get('o2', t.chamber[0]!.x, t.chamber[0]!.y)).toBeLessThan(0.5);
    expect(totalO2(sim, 1)).toBeGreaterThan(before * 0.995);
    sim.enqueue({ type: 'airlock.cycle', moduleId: id, to: 'inner' });
    run(sim, 60);
    expect(sim.world.get(id, AirlockC)!.state).toBe('inner');
    expect(totalO2(sim, 1)).toBeGreaterThan(before * 0.99);
    expect(totalO2(sim, 1)).toBeLessThan(before * 1.01);
  });

  it('waits for the doorway to clear and freezes closed without power', () => {
    const sim = world(1);
    const id = airlocks(sim)[0]!;
    sim.world.get(id, ModuleC)!.enabled = false;
    sim.enqueue({ type: 'airlock.cycle', moduleId: id, to: 'outer' });
    run(sim, 10);
    expect(sim.world.get(id, AirlockC)!.state).toBe('inner');
  });
});

describe('portals', () => {
  it('crew walk from ship A to ship B through linked airlocks', () => {
    const sim = world();
    const c = journey(sim);
    const events = run(sim, 700);
    const pos = sim.world.get(c, PositionC)!;
    expect(pos).toMatchObject({ gridId: 2, x: 5, y: 6 });
    expect(events.filter((e) => e.type === 'crew.crossed')).toEqual([
      expect.objectContaining({ crew: c, fromGridId: 1, toGridId: 2, kind: 'airlock' }),
    ]);
    expect(sim.world.get(c, DraftedC)!.target).toBeNull();
    expect(sim.world.get(c, PathC)!.then).toBeUndefined();
    expect(events.filter((e) => e.type === 'airlock.cycled').length).toBe(3); // A out, B out, B back in
    // And back again.
    sim.enqueue({ type: 'crew.moveTo', id: c, x: 3, y: 6, gridId: 1 });
    run(sim, 700);
    expect(sim.world.get(c, PositionC)).toMatchObject({ gridId: 1, x: 3, y: 6 });
  });

  it('keeps both ships sealed while crew cross', () => {
    const sim = world();
    const a = totalO2(sim, 1);
    const b = totalO2(sim, 2);
    journey(sim);
    run(sim, 700);
    expect(totalO2(sim, 1)).toBeGreaterThan(a * 0.99);
    expect(totalO2(sim, 2)).toBeGreaterThan(b * 0.97);
  });

  it('fails cleanly when unlinked, unsuited or unpowered', () => {
    const sim = world();
    const c = crew(sim, 1, 3, 6);
    expect(planRoute(sim, c, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })).toBeNull();
    sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    sim.enqueue({ type: 'crew.moveTo', id: c, x: 5, y: 6, gridId: 2 });
    run(sim, 100);
    expect(sim.world.get(c, PositionC)).toMatchObject({ gridId: 1, x: 3, y: 6 });
    expect(sim.world.get(c, DraftedC)!.target).toBeNull();

    link(sim);
    run(sim, 2);
    const bare = crew(sim, 1, 3, 6, false);
    expect(planRoute(sim, bare, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })).toBeNull(); // no suit
    expect(planRoute(sim, c, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })).not.toBeNull();
    sim.world.get(airlocks(sim)[1]!, ModuleC)!.enabled = false;
    sim.step();
    expect(planRoute(sim, c, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })).toBeNull(); // far airlock is off
  });

  it('drops the journey if the link is cut mid-way', () => {
    const sim = world();
    const c = journey(sim);
    run(sim, 60);
    sim.enqueue({ type: 'portal.unlink', id: portalIds(sim)[0]! });
    run(sim, 500);
    expect(sim.world.get(c, PositionC)!.gridId).toBe(1);
    expect(sim.world.get(c, PathC)!.then).toBeUndefined();
  });

  it('validates links', () => {
    const sim = world();
    const events: SimEvent[] = [];
    const rejected = (): string[] => events.filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);
    sim.enqueue({ type: 'portal.link', kind: 'airlock', a: LEFT, b: { gridId: 2, x: 4, y: 4 } }); // inner door
    sim.enqueue({ type: 'portal.link', kind: 'airlock', a: LEFT, b: { gridId: 2, x: 2, y: 5 } }); // plain floor
    sim.enqueue({ type: 'portal.link', kind: 'eva', a: LEFT, b: { gridId: 9, x: 0, y: 0 } });
    sim.enqueue({ type: 'portal.link', kind: 'eva', a: LEFT, b: { gridId: 2, x: 4, y: 0 } }); // space
    sim.enqueue({ type: 'portal.link', kind: 'airlock', a: LEFT, b: RIGHT });
    sim.enqueue({ type: 'portal.link', kind: 'airlock', a: RIGHT, b: LEFT });
    run(sim, 2, events);
    expect(rejected()).toEqual(['notOuterDoor', 'notAirlock', 'badGrid', 'notWalkable', 'exists']);
    expect(portalIds(sim)).toHaveLength(1);
    expect(sim.world.get(portalIds(sim)[0]!, PortalC)!.a.airlock).toBe(airlocks(sim)[0]);
  });

  it('plans multi-hop routes and prefers the cheaper link', () => {
    const sim = world(3);
    // 1 <-> 2 costly eva, 1 <-> 3 and 3 <-> 2 by cheap teleporters.
    sim.enqueue({ type: 'portal.link', kind: 'eva', a: LEFT, b: RIGHT });
    sim.enqueue({ type: 'portal.link', kind: 'teleporter', a: { gridId: 1, x: 2, y: 5 }, b: { gridId: 3, x: 2, y: 5 } });
    sim.enqueue({ type: 'portal.link', kind: 'teleporter', a: { gridId: 3, x: 6, y: 5 }, b: { gridId: 2, x: 6, y: 5 } });
    run(sim, 2);
    const route = planRoute(sim, 0, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })!;
    expect(route.then).toHaveLength(2);
    expect(route.then.map((l) => sim.world.get(l.portal, PortalC)!.kind)).toEqual(['teleporter', 'teleporter']);
    expect(route.then[1]!.steps.at(-1)).toEqual({ x: 5, y: 6 });
    expect(planRoute(sim, 0, { gridId: 1, x: 3, y: 6 }, { gridId: 2, x: 5, y: 6 })).toEqual(route);
  });

  it('caches per-grid legs and drops them when the grid changes', () => {
    const sim = world(1);
    const from = { x: 2, y: 5 };
    const goal = { x: 6, y: 6 };
    const a = cachedPath(sim, 1, from, goal);
    expect(cachedPath(sim, 1, from, goal)).toBe(a);
    expect(a).toEqual(findPath(sim, 1, from, goal));
    sim.grids.get(1)!.set('struct', 4, 6, Struct.Wall);
    const b = cachedPath(sim, 1, from, goal);
    expect(b).not.toBe(a);
    expect(b).toEqual(findPath(sim, 1, from, goal));
  });
});

describe('determinism and saves', () => {
  it('gives identical state for identical runs', () => {
    const a = world();
    const b = world();
    journey(a);
    journey(b);
    run(a, 400);
    run(b, 400);
    expect(serialize(a)).toBe(serialize(b));
  });

  it('round-trips mid-crossing and finishes the same', () => {
    const sim = world();
    const c = journey(sim);
    let mid = 0;
    for (let i = 0; i < 700 && !mid; i++) {
      run(sim, 1);
      if (sim.world.get(c, PositionC)!.gridId === 1 && sim.world.get(c, PathC)!.then?.length && sim.world.has(c, CrossingKey)) mid = i;
    }
    expect(mid).toBeGreaterThan(0);
    const copy = deserialize(serialize(sim), content);
    expect(serialize(copy)).toBe(serialize(sim));
    run(sim, 400);
    run(copy, 400);
    expect(sim.world.get(c, PositionC)).toMatchObject({ gridId: 2, x: 5, y: 6 });
    expect(serialize(copy)).toBe(serialize(sim));
  });

  it('migrates a v6 save', () => {
    const sim = world();
    const raw = JSON.parse(serialize(sim)) as { version: number; world: { stores: Record<string, unknown> } };
    raw.version = 6;
    delete raw.world.stores['portal'];
    delete raw.world.stores['airlock'];
    const data = migrate(raw as never) as unknown as { version: number; world: { stores: Record<string, unknown> } };
    expect(data.version).toBe(10);
    expect(deserialize(JSON.stringify(raw), content).world.query(PortalC)).toHaveLength(0);
  });
});
