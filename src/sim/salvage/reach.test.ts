import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { CrewC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { salvageJobs } from './plan';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({ name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o });
const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], recipes: {},
  species: { 'species.human': { name: 'H', moveSpeed: 3, workSpeed: 2, restDecay: 0, airless: true } },
  modules: { console: mod({ scrap: 'tech', cost: [{ item: 'item.metal', count: 6 }] }) },
  items: { 'item.metal': { name: 'Metal', tags: [], stackSize: 100 }, 'item.scrap_tech': { name: 't', tags: ['scrap'], stackSize: 100 }, 'item.scrap_hull': { name: 'h', tags: ['scrap'], stackSize: 100 } },
  structCosts: { floor: [{ item: 'item.metal', count: 1 }], wall: [{ item: 'item.metal', count: 2 }] },
};
const prio = (v: number): Priorities => ({ firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v });
// Two sealed halls side by side: crew in the west one, the console in the east one.
const rows = ['#########', '#___#___#', '#___#___#', '#########'];

function setup(withCrew: boolean): { sim: Sim; w: number; crew: number } {
  const sim = new Sim(4, content);
  const w = stampShip(sim, { name: 'Wreck', rows, modules: [{ def: 'console', x: 6, y: 1, rot: 0 }] }, { faction: 'neutral', x: 0, y: 0, state: 'wreck' });
  const g = sim.sector.grid;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 9; x++) { g.set('o2', x, y, 21); g.set('temp', x, y, 20); }
  const crew = withCrew ? person(sim) : 0;
  return { sim, w, crew };
}
function person(sim: Sim): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x: 2, y: 1, toX: 2, toY: 1, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, prio(3));
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction: 'player' });
  return id;
}
const kinds = (sim: Sim, w: number): string[] => salvageJobs(sim, w).map((j) => sim.world.get(j, JobC)!.kind);
function run(sim: Sim, n: number, stop: () => boolean): void {
  for (let i = 0; i < n && !stop(); i++) sim.step();
}

describe('salvage jobs nobody can reach', () => {
  it('skips a module the crew cannot reach and takes down the walls in the way first', () => {
    const { sim, w } = setup(true);
    sim.enqueue({ type: 'salvage.order', ship: w, types: ['tech', 'hull'] });
    run(sim, 12, () => false);
    expect(kinds(sim, w)).not.toContain('moduleDecon'); // the console is sealed off
    expect(kinds(sim, w).length).toBeGreaterThan(0);
    // The dividing wall comes down, and then the console can be stripped.
    run(sim, 6000, () => sim.world.query(ModuleC).length === 0);
    expect(sim.world.query(ModuleC)).toHaveLength(0);
  });

  it('drops an open job nobody holds once the crew there cannot reach it, so it does not hold a place under the cap', () => {
    const { sim, w } = setup(false);
    sim.enqueue({ type: 'salvage.order', ship: w, types: ['tech'] });
    run(sim, 12, () => false);
    expect(kinds(sim, w)).toEqual(['moduleDecon']); // nobody aboard: nothing can be judged out of reach
    person(sim);
    run(sim, 12, () => false);
    expect(kinds(sim, w)).toEqual([]);
  });
});
