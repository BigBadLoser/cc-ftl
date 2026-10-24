import { describe, expect, it } from 'vitest';

import {
  BedClaimC, CrewC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';

import { findPath } from '../crew/pathfind';

import type { SimEvent } from '../events';
import type { ContentRegistry, ModuleDef } from '../registry';
import { spawnTemplateModules } from '../ship';
import { Sim } from '../sim';

import { stampShip } from '../combat/ships';

import type { ShipTemplate } from '../registry';

import { CREW_MAX_HP } from '../tuning';

import { ModuleC } from './components';

import { accessTile, footprintTiles } from './footprint';

import { shipGrid } from '../regions';


/** A fixture ship: the template stamped at the sector origin as an inert ship (a prize is skipped by every ship system). It is the first entity, so its id is 1. */
function fixtureShip(sim: Sim, t: ShipTemplate): number {
  return stampShip(sim, t, { faction: 'player', state: 'prize', x: 0, y: 0 });
}

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 40, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: {
    block: mod({ footprint: [2, 1], solid: true, buildWork: 60 }),
    console: mod({ solid: true, access: [0, 1] }),
    bed: mod({ footprint: [1, 2], bed: true }),
  },
  crewNames: [],
  items: {},
  recipes: {},
  structCosts: {},
};
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, cooking: v, patrol: v,
});
// A 5x3 corridor-like room: a solid block placed in the middle row can be walked around.
const rows = ['.......', '.#####.', '.#___#.', '.#___#.', '.#___#.', '.#####.', '.......'];

function make(): Sim {
  const sim = new Sim(2, content);
  fixtureShip(sim, { name: 't', rows });
  return sim;
}
function crew(sim: Sim, x: number, y: number, p: Priorities = all(4), rest = 100): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...p });
  sim.world.add(id, NeedsC, { rest });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  return id;
}
const run = (sim: Sim, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const construction: Priorities = { ...all(4), construction: 1 };
const modulesOf = (sim: Sim, def: string) => sim.world.query(ModuleC).filter((i) => sim.world.get(i, ModuleC)!.def === def);

describe('footprints', () => {
  it('rotate tiles and the access offset clockwise', () => {
    const block = content.modules['block']!;
    expect(footprintTiles(block, 2, 2, 0)).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(footprintTiles(block, 2, 2, 1)).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }]);
    const c = content.modules['console']!;
    expect(accessTile(c, 3, 3, 0)).toEqual({ x: 3, y: 4 });
    expect(accessTile(c, 3, 3, 1)).toEqual({ x: 2, y: 3 });
    expect(accessTile(c, 3, 3, 2)).toEqual({ x: 3, y: 2 });
    expect(accessTile(c, 3, 3, 3)).toEqual({ x: 4, y: 3 });
  });
});

describe('modules', () => {
  it('are built by a construction job, claim their tiles and block pathing', () => {
    const sim = make();
    const id = crew(sim, 2, 4, construction);
    sim.enqueue({ type: 'job.buildModule', ship: 1, x: 3, y: 3, def: 'block', rot: 0 });
    const events: SimEvent[] = [];
    run(sim, 3);
    expect(sim.world.query(JobC)).toHaveLength(1);
    expect(shipGrid(sim, 1)!.get('module', 3, 3)).toBe(0); // only a blueprint so far
    for (let i = 0; i < 400 && modulesOf(sim, 'block').length === 0; i++) {
      sim.step();
      events.push(...sim.events.drain());
    }
    const [block] = modulesOf(sim, 'block') as [number];
    const g = shipGrid(sim, 1)!;
    expect([g.get('module', 3, 3), g.get('module', 4, 3), g.get('module', 2, 3)]).toEqual([block, block, 0]);
    expect(sim.world.get(block, ModuleC)).toMatchObject({ hp: 100, enabled: true, rot: 0 });
    expect(events.some((e) => e.type === 'crew.jobDone' && e.kind === 'module')).toBe(true);
    expect(sim.world.query(JobC)).toHaveLength(0);
    // Solid: no path onto it, but a path around it.
    expect(findPath(sim, 1, { x: 2, y: 3 }, { x: 3, y: 3 })).toBeNull();
    const around = findPath(sim, 1, { x: 2, y: 3 }, { x: 4, y: 4 });
    expect(around).not.toBeNull();
    expect(around!.some((t) => g.get('module', t.x, t.y) !== 0)).toBe(false);
    expect(sim.world.has(id, CrewC)).toBe(true);
  });

  it('wait for crew to step off the footprint before appearing', () => {
    const sim = make();
    const id = crew(sim, 3, 3, construction);
    sim.enqueue({ type: 'job.buildModule', ship: 1, x: 3, y: 3, def: 'block', rot: 0 });
    run(sim, 200);
    expect(modulesOf(sim, 'block')).toHaveLength(1);
    const p = sim.world.get(id, PositionC)!;
    expect(shipGrid(sim, 1)!.get('module', p.x, p.y)).toBe(0);
  });

  it('are deconstructed by a job and free their tiles', () => {
    const sim = make();
    crew(sim, 2, 4, construction);
    sim.enqueue({ type: 'job.buildModule', ship: 1, x: 3, y: 3, def: 'block', rot: 0 });
    run(sim, 300);
    expect(modulesOf(sim, 'block')).toHaveLength(1);
    sim.enqueue({ type: 'job.deconstructModule', ship: 1, x: 4, y: 3 }); // any footprint tile
    run(sim, 300);
    expect(modulesOf(sim, 'block')).toHaveLength(0);
    expect(shipGrid(sim, 1)!.get('module', 3, 3)).toBe(0);
    expect(findPath(sim, 1, { x: 2, y: 3 }, { x: 3, y: 3 })).not.toBeNull();
  });

  it('reject bad placement', () => {
    const sim = make();
    const reasons = (): string[] => sim.events.drain().flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));
    const build = (x: number, y: number, def = 'block', rot = 0) =>
      sim.enqueue({ type: 'job.buildModule', ship: 1, x, y, def, rot });
    build(1, 1); // on a wall
    build(4, 2); // second tile off the room
    build(2, 2, 'nope');
    build(2, 2, 'block', 7);
    build(2, 2, 'console', 2); // access tile is the wall above
    sim.step();
    expect(reasons()).toEqual(['notFloor', 'notFloor', 'badDef', 'badRot', 'noAccess']);
    build(2, 2);
    build(3, 2); // overlaps the first blueprint
    sim.step();
    expect(reasons()).toEqual(['jobExists']);
    sim.enqueue({ type: 'job.deconstructModule', ship: 1, x: 2, y: 2 });
    sim.enqueue({ type: 'module.setPowerPriority', id: 999, powerPriority: 2 });
    sim.step();
    expect(reasons()).toEqual(['noModule', 'noModule']);
  });

  it('set priority and enabled through commands', () => {
    const sim = make();
    spawnTemplateModules(sim, 1, { name: 't', rows, modules: [{ def: 'bed', x: 2, y: 2, rot: 0 }] });
    const [bed] = modulesOf(sim, 'bed') as [number];
    sim.enqueue({ type: 'module.setPowerPriority', id: bed, powerPriority: 5 });
    sim.enqueue({ type: 'module.setEnabled', id: bed, enabled: false });
    sim.step();
    expect(sim.world.get(bed, ModuleC)).toMatchObject({ powerPriority: 5, enabled: false });
    sim.enqueue({ type: 'module.setPowerPriority', id: bed, powerPriority: 9 });
    sim.step();
    expect(sim.world.get(bed, ModuleC)!.powerPriority).toBe(5);
  });
});

describe('beds', () => {
  it('tired crew reserve a free bed, walk to it and rest twice as fast as on the floor', () => {
    const restAfter = (withBed: boolean): { rest: number; claimed: boolean } => {
      const sim = make();
      if (withBed) spawnTemplateModules(sim, 1, { name: 't', rows, modules: [{ def: 'bed', x: 4, y: 2, rot: 0 }] });
      const id = crew(sim, 2, 4, all(0), 10);
      run(sim, 20 * 6);
      const claimed = sim.world.has(id, BedClaimC);
      return { rest: sim.world.get(id, NeedsC)!.rest, claimed };
    };
    const floor = restAfter(false);
    const bed = restAfter(true);
    expect(floor.claimed).toBe(false);
    expect(bed.claimed).toBe(true);
    expect(bed.rest).toBeGreaterThan(floor.rest);
  });

  it('are not shared: the second sleeper takes the floor and the bed frees on waking', () => {
    const sim = make();
    spawnTemplateModules(sim, 1, { name: 't', rows, modules: [{ def: 'bed', x: 4, y: 2, rot: 0 }] });
    const a = crew(sim, 2, 4, all(0), 5);
    const b = crew(sim, 2, 3, all(0), 5);
    run(sim, 30);
    const claims = [a, b].filter((i) => sim.world.has(i, BedClaimC));
    expect(claims).toHaveLength(1);
    const [bed] = modulesOf(sim, 'bed') as [number];
    expect(sim.world.get(bed, ModuleC)!.reservedBy).toBe(claims[0]);
    run(sim, 20 * 120);
    expect(sim.world.get(bed, ModuleC)!.reservedBy).toBe(0);
  });
});
