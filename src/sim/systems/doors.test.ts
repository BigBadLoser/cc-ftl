import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { CrewC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { findPath } from '../crew/pathfind';
import type { SimEvent } from '../events';
import { shipGrid } from '../regions';
import type { ContentRegistry } from '../registry';
import { Sim } from '../sim';
import { DoorJam } from '../structure';

const rows = ['#########', '#___#___#', '#___D___#', '#___#___#', '#########'];
const all = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v,
});
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: { ...all(4), construction: 1 } } },
  modules: {},
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  crewNames: ['A'],
  items: {},
  recipes: {},
  structCosts: {},
};

function make(jam: number): Sim {
  const sim = new Sim(7, content);
  stampShip(sim, content.ships['ship.t']!, { faction: 'player', state: 'prize', x: 0, y: 0 });
  shipGrid(sim, 1)!.set('jam', 4, 2, jam);
  return sim;
}

function spawn(sim: Sim, x: number, y: number): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'role.engineer', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all(4), construction: 1 });
  sim.world.add(id, NeedsC, { rest: 100 });
  return id;
}

const run = (sim: Sim, n: number): void => { for (let i = 0; i < n; i++) sim.step(); };
const door = (sim: Sim): number => shipGrid(sim, 1)!.get('door', 4, 2);

describe('jammed doors', () => {
  it('a door jammed open stays open and one jammed shut stays shut', () => {
    const open = make(DoorJam.Open);
    run(open, 60);
    expect(door(open)).toBe(255);
    const shut = make(DoorJam.Shut);
    shipGrid(shut, 1)!.set('door', 4, 2, 255);
    run(shut, 2);
    expect(door(shut)).toBe(0);
  });

  it('a door jammed shut blocks walking until it is forced', () => {
    const sim = make(DoorJam.Shut);
    expect(findPath(sim, 1, { x: 1, y: 2 }, { x: 6, y: 2 })).toBeNull();
    shipGrid(sim, 1)!.set('jam', 4, 2, DoorJam.None);
    expect(findPath(sim, 1, { x: 1, y: 2 }, { x: 6, y: 2 })).not.toBeNull();
  });

  it('crew force a jammed door with a timed job; an unjammed door is refused', () => {
    const sim = make(DoorJam.Shut);
    spawn(sim, 1, 2);
    sim.enqueue({ type: 'job.forceDoor', ship: 1, x: 4, y: 2 });
    let ticks = 0;
    while (shipGrid(sim, 1)!.get('jam', 4, 2) !== DoorJam.None && ticks < 2000) { sim.step(); ticks++; }
    expect(shipGrid(sim, 1)!.get('jam', 4, 2)).toBe(DoorJam.None);
    expect(ticks).toBeGreaterThan(5 * 20);
    sim.events.drain();
    sim.enqueue({ type: 'job.forceDoor', ship: 1, x: 4, y: 2 });
    sim.step();
    const rejected = sim.events.drain().find((e: SimEvent) => e.type === 'command.rejected');
    expect(rejected).toMatchObject({ reason: 'notJammed' });
  });
});
