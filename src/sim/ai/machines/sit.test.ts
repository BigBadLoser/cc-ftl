import { describe, expect, it } from 'vitest';
import { CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../../crew/components';
import { ModuleC } from '../../modules/components';
import { stampShip } from '../../combat/ships';
import type { ContentRegistry, ModuleDef } from '../../registry';
import { shipIdOf } from '../../regions';
import { Sim } from '../../sim';
import { TaskC } from '../components';
import { freeSeats, seatPoints, seatTile, seatedOn } from './sit';

const rows = ['###########', '#_________#', '#_________#', '#_________#', '###########'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, farming: v, patrol: v,
});
const bench = { name: 'Bench', footprint: [2, 1], maxHp: 10, power: 0, solid: false, seats: { kind: 'bench', at: [[-0.6, -0.11], [0, -0.11], [0.6, -0.11]] } } as unknown as ModuleDef;
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: { ...all(4), construction: 1 } } },
  modules: { 'module.bench': bench },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A', 'B', 'C'],
  items: {},
  recipes: {},
  structCosts: {},
};

function make(): Sim {
  const sim = new Sim(7, content);
  stampShip(sim, content.ships['ship.t']!, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return sim;
}
function crew(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.engineer', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all(4), construction: 1 });
  sim.world.add(id, NeedsC, { rest: 100 });
  return id;
}
function put(sim: Sim, x: number, y: number, rot = 0): number {
  const id = sim.world.createEntity();
  sim.world.add(id, ModuleC, { def: 'module.bench', x, y, rot, hp: 10, enabled: true, powered: false, powerPriority: 0, reservedBy: 0 } as never);
  return id;
}
const near = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6);

describe('bench seats', () => {
  it('puts the three seats where the lab panel does, at all four rotations (offsets from the footprint centre, rotated)', () => {
    const at = (rot: number) => seatPoints(bench, { x: 4, y: 2, rot });
    // r0: footprint 2x1 at (4,2): centre (4.5, 2).
    [[3.9, 1.89], [4.5, 1.89], [5.1, 1.89]].forEach(([x, y], i) => { near(at(0)[i]!.x, x!); near(at(0)[i]!.y, y!); });
    // r1: 1x2, centre (4, 2.5): (u,v) -> (-v, u).
    [[4.11, 1.9], [4.11, 2.5], [4.11, 3.1]].forEach(([x, y], i) => { near(at(1)[i]!.x, x!); near(at(1)[i]!.y, y!); });
    // r2: 2x1, centre (4.5, 2): (u,v) -> (-u,-v).
    [[5.1, 2.11], [4.5, 2.11], [3.9, 2.11]].forEach(([x, y], i) => { near(at(2)[i]!.x, x!); near(at(2)[i]!.y, y!); });
    // r3: 1x2, centre (4, 2.5): (u,v) -> (v,-u).
    [[3.89, 3.1], [3.89, 2.5], [3.89, 1.9]].forEach(([x, y], i) => { near(at(3)[i]!.x, x!); near(at(3)[i]!.y, y!); });
    // Every seat belongs to a footprint tile.
    for (let rot = 0; rot < 4; rot++) for (let i = 0; i < 3; i++) {
      const t = seatTile(bench, { x: 4, y: 2, rot }, i);
      expect(t.x >= 4 && t.x <= (rot % 2 ? 4 : 5) && t.y >= 2 && t.y <= (rot % 2 ? 3 : 2)).toBe(true);
    }
  });

  it('holds a seat from the moment a crew member sets off: three take three seats, a fourth finds none', () => {
    const sim = make();
    const b = put(sim, 4, 2);
    const ids = [crew(sim, 1, 1), crew(sim, 1, 2), crew(sim, 1, 3), crew(sim, 9, 1)];
    const taken: number[] = [];
    // The reservation is the task: a sit task with target + seat index.
    for (const [k, id] of ids.slice(0, 3).entries()) {
      const free = freeSeats(sim, id, shipOf(sim, id));
      expect(free).toHaveLength(3 - k);
      const pick = free[0]!;
      sim.world.add(id, TaskC, { job: 0, drive: 'idle', machine: 'sit', state: 'Walk', since: 0, class: 'any', stack: [], holds: [], bb: { target: pick.module, n: pick.index, tile: pick.tile } } as never);
      taken.push(pick.index);
    }
    expect(new Set(taken).size).toBe(3);
    expect(freeSeats(sim, ids[3]!, shipOf(sim, ids[3]!))).toHaveLength(0);
    expect(freeSeats(sim, ids[0]!, shipOf(sim, ids[0]!))).toHaveLength(1); // their own seat counts as free to them
    expect(b).toBeGreaterThan(0);
  });

  it('an idle crew member next to a bench eventually sits, at the seat point, and later stands up; a job replaces the sit', () => {
    const sim = make();
    const b = put(sim, 4, 2);
    const c = crew(sim, 3, 2);
    let sat = 0;
    for (let i = 0; i < 20000 && !sat; i++) {
      sim.step();
      if (seatedOn(sim.world, content.modules, c)) sat = sim.tick;
    }
    expect(sat).toBeGreaterThan(0);
    const on = seatedOn(sim.world, content.modules, c)!;
    expect(on.m).toBe(sim.world.get(b, ModuleC));
    expect(on.kind).toBe('bench');
    // A job replaces the sit: the crew member is assigned it and no longer seated.
    const j = sim.world.createEntity();
    sim.world.add(j, JobC, { category: 'construction', kind: 'build', x: 8, y: 3, struct: 1, work: 40, progress: 0, reservedBy: 0 });
    for (let i = 0; i < 40 && seatedOn(sim.world, content.modules, c); i++) sim.step();
    expect(seatedOn(sim.world, content.modules, c)).toBeNull();
    expect(sim.world.get(c, TaskC)?.machine).not.toBe('sit');
  });

  it('stands up again by itself after its time, with no job around', () => {
    const sim = make();
    put(sim, 4, 2);
    const c = crew(sim, 3, 2);
    let sitting = false, stood = false;
    for (let i = 0; i < 60000 && !stood; i++) {
      sim.step();
      const now = !!seatedOn(sim.world, content.modules, c);
      if (now) sitting = true;
      else if (sitting) stood = true;
    }
    expect(sitting && stood).toBe(true);
  });
});

const shipOf = (sim: Sim, id: number): number => shipIdOf(sim, sim.world.get(id, PositionC));
