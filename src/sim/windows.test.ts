import { describe, expect, it } from 'vitest';

import { stampShip } from './combat/ships';
import { damageStruct } from './combat/hull';
import { CrewC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from './crew/components';
import { ItemStackC } from './items/components';
import { deserialize, serialize } from './save';
import { shipGrid } from './regions';
import { Sim } from './sim';
import { Struct, writeStruct } from './structure';
import type { SimEvent } from './events';
import type { ContentRegistry } from './registry';
import { decodeWindow, windowAt, windowCode, windowPiece, windowRunError } from './windows';

const item = { name: 'i', tags: [], stackSize: 100 };
const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], modules: {}, recipes: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6, carryCapacity: 20 } },
  items: { metal: item, polymer: item },
  structCosts: { wall: [{ item: 'metal', count: 2 }], window: [{ item: 'metal', count: 2 }, { item: 'polymer', count: 1 }] },
};
// A partition at x = 7 (y 1..4) and a stub at x = 3 with a side wall at y = 3 (a T) make the special cases.
const rows = [
  '##############',
  '#__#____#____#',
  '#__#____#____#',
  '#__###__#____#',
  '#__#____#____#',
  '##############',
];
const prio = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: 1, hauling: 1, refining: v, crafting: v, research: v, cooking: v, farming: v, patrol: v,
});

function make(): { sim: Sim; ship: number } {
  const sim = new Sim(5, content);
  const ship = stampShip(sim, { name: 't', rows }, { faction: 'player', state: 'prize', x: 0, y: 0 });
  return { sim, ship };
}
function addCrew(sim: Sim): void {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x: 5, y: 2, toX: 5, toY: 2, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, prio(4));
  sim.world.add(id, NeedsC, { rest: 100 });
}
function run(sim: Sim, n: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
}
const grid = (sim: Sim, ship: number) => shipGrid(sim, ship)!;

describe('window placement rules', () => {
  const { sim, ship } = make();
  const g = grid(sim, ship);
  it('accepts a straight run on the hull and on a partition', () => {
    expect(windowRunError(g, 4, 0, 'x', 2)).toBeNull();
    expect(windowRunError(g, 4, 0, 'x', 4)).toBeNull();
    expect(windowRunError(g, 8, 1, 'y', 3)).toBeNull();
    expect(windowRunError(g, 8, 1, 'y', 4)).toBeNull();
  });
  it('rejects bad sizes, floor, corners and T-junctions', () => {
    expect(windowRunError(g, 4, 0, 'x', 5)).toBe('badSize');
    expect(windowRunError(g, 4, 0, 'x', 1)).toBe('badSize');
    expect(windowRunError(g, 4, 1, 'x', 2)).toBe('notWall'); // floor
    expect(windowRunError(g, 0, 0, 'x', 2)).toBe('notStraight'); // the corner
    expect(windowRunError(g, 11, 0, 'x', 3)).toBe('notStraight'); // reaches the corner
    expect(windowRunError(g, 3, 1, 'y', 3)).toBe('notStraight'); // the T where the side wall meets it
    expect(windowRunError(g, 12, 9, 'x', 2)).toBe('outOfBounds');
  });
  it('rejects a tile with a window or a job', () => {
    const { sim: s2, ship: sh2 } = make();
    const g2 = grid(s2, sh2);
    g2.set('window', 5, 0, windowCode('x', 2, 0));
    expect(windowRunError(g2, 4, 0, 'x', 2)).toBe('hasWindow');
    expect(windowRunError(g2, 8, 1, 'y', 2, (x, y) => x === 8 && y === 2)).toBe('jobExists');
  });
  it('rejects a wall tile a module stands on (an engine hull row)', () => {
    const { sim: s3, ship: sh3 } = make();
    const g3 = grid(s3, sh3);
    expect(g3.has('module')).toBe(true);
    g3.set('module', 6, 0, 1);
    expect(windowRunError(g3, 5, 0, 'x', 3)).toBe('moduleHere');
    expect(windowRunError(g3, 4, 0, 'x', 2)).toBeNull();
  });
});

describe('window encoding', () => {
  it('round-trips and names pieces', () => {
    for (const axis of ['x', 'y'] as const) for (const size of [2, 3, 4]) for (let i = 0; i < size; i++) {
      expect(decodeWindow(windowCode(axis, size, i))).toEqual({ axis, size, index: i });
    }
    const pieces = (size: number) => Array.from({ length: size }, (_, i) => windowPiece({ axis: 'x', size, index: i }));
    expect(pieces(2)).toEqual(['l', 'r']);
    expect(pieces(3)).toEqual(['l', 'm', 'r']);
    expect(pieces(4)).toEqual(['l', 'm', 'm', 'r']);
    expect(decodeWindow(0)).toBeNull();
  });
});

describe('building and removing windows', () => {
  it('posts one job per tile, hauled materials are used, completion sets the window state, the tile stays a wall', () => {
    const { sim, ship } = make();
    addCrew(sim);
    sim.enqueue({ type: 'job.window', ship, x: 8, y: 1, axis: 'y', size: 3 });
    run(sim, 1);
    const jobs = sim.world.query(JobC).map((j) => sim.world.get(j, JobC)!);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]!.needs).toEqual([{ item: 'metal', count: 2 }, { item: 'polymer', count: 1 }]);
    sim.enqueue({ type: 'debug.spawnItems', ship, x: 6, y: 2, item: 'metal', count: 6 });
    sim.enqueue({ type: 'debug.spawnItems', ship, x: 6, y: 3, item: 'polymer', count: 3 });
    run(sim, 3000);
    const g = grid(sim, ship);
    expect([1, 2, 3].map((y) => windowAt(g, 8, y)?.index)).toEqual([0, 1, 2]);
    expect(windowAt(g, 8, 1)).toMatchObject({ axis: 'y', size: 3 });
    expect(g.get('struct', 8, 2)).toBe(Struct.Wall);
    expect(sim.world.query(JobC)).toHaveLength(0);
  });

  it('deconstructing a window tile gives back wall (not floor) and half the cost', () => {
    const { sim, ship } = make();
    addCrew(sim);
    const g = grid(sim, ship);
    for (let i = 0; i < 2; i++) g.set('window', 4 + i, 0, windowCode('x', 2, i));
    sim.enqueue({ type: 'job.deconstruct', ship, x: 4, y: 0 });
    run(sim, 400);
    expect(g.get('struct', 4, 0)).toBe(Struct.Wall);
    expect(windowAt(g, 4, 0)).toBeNull();
    expect(windowAt(g, 5, 0)).not.toBeNull(); // the other tile stays window
    const refund = sim.world.query(ItemStackC).map((s) => sim.world.get(s, ItemStackC)!);
    expect(refund.find((s) => s.item === 'metal')?.count).toBe(1);
    expect(refund.find((s) => s.item === 'polymer')).toBeUndefined(); // half of 1 rounds down
  });

  it('rejects a window on floor, and a second order on the same run', () => {
    const { sim, ship } = make();
    sim.enqueue({ type: 'job.window', ship, x: 4, y: 1, axis: 'x', size: 2 });
    sim.enqueue({ type: 'job.window', ship, x: 8, y: 1, axis: 'y', size: 2 });
    sim.enqueue({ type: 'job.window', ship, x: 8, y: 2, axis: 'y', size: 2 });
    const events = run(sim, 1);
    expect(events.filter((e) => e.type === 'command.rejected').map((e) => e.reason)).toEqual(['notWall', 'jobExists']);
  });
});

describe('window state on struct changes', () => {
  it('a breached tile goes as a wall does; the rest of the window stays', () => {
    const { sim, ship } = make();
    const g = grid(sim, ship);
    for (let i = 0; i < 3; i++) g.set('window', 8, 1 + i, windowCode('y', 3, i));
    expect(damageStruct(g, 8, 2, 1000)).toBe(true);
    expect(g.get('struct', 8, 2)).toBe(Struct.Floor);
    expect(windowAt(g, 8, 2)).toBeNull();
    expect(windowAt(g, 8, 1)).toMatchObject({ index: 0 });
    expect(windowAt(g, 8, 3)).toMatchObject({ index: 2 });
  });
  it('writeStruct clears the window', () => {
    const { sim, ship } = make();
    const g = grid(sim, ship);
    g.set('window', 4, 0, windowCode('x', 2, 0));
    writeStruct(g, 4, 0, Struct.Floor);
    expect(g.get('window', 4, 0)).toBe(0);
  });
  it('survives a save round-trip', () => {
    const { sim, ship } = make();
    grid(sim, ship).set('window', 4, 0, windowCode('x', 4, 2));
    const copy = deserialize(serialize(sim), content);
    expect(windowAt(shipGrid(copy, ship)!, 4, 0)).toEqual({ axis: 'x', size: 4, index: 2 });
  });
});
