import { describe, expect, it } from 'vitest';
import { stampShip } from '../sim/combat/ships';
import { AllegianceC } from '../sim/fight/components';
import { CrewC, DraftedC, NeedsC, PathC, PositionC, PrioritiesC } from '../sim/crew/components';
import { shipGrid } from '../sim/regions';
import type { ContentRegistry } from '../sim/registry';
import { Sim } from '../sim/sim';
import { DoorJam } from '../sim/structure';
import type { Renderer } from '../render/scene';
import { planOrders } from './crewOrders';

const rows = ['#########', '#___#___#', '#___D___#', '#___#___#', '#########'];
const p = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 1, hauling: 4, refining: 4, crafting: 4, research: 4, cooking: 4, patrol: 4 };
const content: ContentRegistry = {
  ships: { 'ship.t': { name: 't', rows } },
  roles: { 'role.engineer': { name: 'E', priorities: p } },
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
  sim.world.add(id, PrioritiesC, p);
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, AllegianceC, { faction: 'player' });
  return id;
}

describe('right-click menu on a jammed door', () => {
  const renderer = (x: number, y: number): Renderer => ({
    pickCrew: () => null, pickShuttle: () => null, pickModule: () => null, addOrderMarker: () => {},
    pickTileAny: () => ({ x, y, shipId: 1 }),
  }) as unknown as Renderer;

  it('offers Force door only on a jammed door, and only with drafted crew selected', () => {
    const sim = make(DoorJam.Shut);
    const c = spawn(sim, 1, 2);
    expect(planOrders(sim, renderer(4, 2), 0, 0, [c]).choices).toEqual([]); // not drafted
    sim.world.add(c, DraftedC, { target: null });
    expect(planOrders(sim, renderer(4, 2), 0, 0, [c]).choices.map((x) => x.id)).toEqual(['forceDoor']);
    expect(planOrders(sim, renderer(2, 2), 0, 0, [c]).choices.map((x) => x.id)).toEqual(['walk']); // plain floor
    shipGrid(sim, 1)!.set('jam', 4, 2, DoorJam.None);
    expect(planOrders(sim, renderer(4, 2), 0, 0, [c]).choices.map((x) => x.id)).not.toContain('forceDoor');
    shipGrid(sim, 1)!.set('jam', 4, 2, DoorJam.Open);
    const plan = planOrders(sim, renderer(4, 2), 0, 0, [c]);
    expect(plan.choices.map((x) => x.id)).toEqual(['forceDoor']); // held open counts too
    plan.run('forceDoor');
    for (let i = 0; i < 400; i++) sim.step();
    expect(shipGrid(sim, 1)!.get('jam', 4, 2)).toBe(DoorJam.None);
    expect(sim.world.has(c, DraftedC)).toBe(true);
  });
});
