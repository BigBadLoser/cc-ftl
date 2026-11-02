/** Shared setup for the air tests (travel, sources, stores, refill, admission): a 14x14 player ship with an airlock on its east hull, a shuttle def and crew. */
import { ALT, BodyC } from '../body';
import { CombatC } from '../combat/components';
import { newHeat } from '../combat/heat';
import { stampShip } from '../combat/ships';
import { CrewC, DraftedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import type { SimEvent } from '../events';
import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { placementError, spawnModule } from '../modules/spawn';
import type { ContentRegistry, ModuleDef } from '../registry';
import { shipIdOf } from '../regions';
import { Sim } from '../sim';
import { CREW_MAX_HP } from '../tuning';
import { VehicleC } from '../vehicles/components';

const airlockDef: ModuleDef = {
  name: 'Airlock', asset: 'a', footprint: [3, 4], solid: true, power: 0, flammability: 0.1, maxHp: 120, buildWork: 20, hullEdge: 'n',
  openTiles: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [2, 3]],
  airlock: {
    cycleSec: 2, suits: 3,
    layout: { outer: [1, 0], inner: [1, 1], inside: [1, 2], collar: [1, -1], unloaders: [{ tiles: [[0, 1], [0, 2]], chute: [0, 2], stand: [0, 3] }, { tiles: [[2, 1], [2, 2]], chute: [2, 2], stand: [2, 3] }] },
  },
};
const lifeSupportDef: ModuleDef = { name: 'LS', asset: 'l', footprint: [1, 1], solid: false, power: 0, flammability: 0, maxHp: 50, buildWork: 10, o2PerSec: 1 };
export const shuttleDef = { name: 'S', class: 'shuttle', asset: 's', speed: 8, maxHp: 90, capacity: 4, evasion: 0, eva: { suits: 3, hoverGap: 4.5 } };
export const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 },
    'species.robot': { name: 'R', moveSpeed: 2, workSpeed: 1, restDecay: 0, airless: true },
  },
  modules: { airlock: airlockDef, lifeSupport: lifeSupportDef },
  vehicles: { 'vehicle.shuttle': shuttleDef },
};
export const all4: Priorities = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 4, hauling: 4, refining: 4, crafting: 4, research: 4, cooking: 4, patrol: 0 };

/** A 14x14 ship: hull ring, 10x10 floor. */
export const ring = (): string[] => {
  const rows = ['.'.repeat(14), '.' + '#'.repeat(12) + '.'];
  for (let i = 0; i < 10; i++) rows.push('.#' + '_'.repeat(10) + '#.');
  rows.push('.' + '#'.repeat(12) + '.', '.'.repeat(14));
  return rows;
}

/** Ship 1 (player) at the sector origin with an airlock on its east hull. `lifeSupport`: a working life support module inside it. */
export function world(o: { lifeSupport?: boolean; faction?: 'player' | 'neutral'; state?: 'active' | 'wreck'; airlock?: boolean } = {}): Sim {
  const sim = new Sim(7, content);
  const ship = stampShip(sim, { name: 's1', rows: ring() }, { faction: o.faction ?? 'player', x: 0, y: 0, ...(o.state ? { state: o.state } : {}) });
  sim.world.add(ship, CombatC, { hold: false, volley: false, target: null, doctrine: 'random', ftl: 0, shield: { layers: 0, max: 0, timer: 0 }, heat: newHeat(), evasion: 0, pilot: 0, cruisePilot: 0, cruiseEvasion: 0, aiTimer: 0 });
  if (o.airlock !== false) {
    if (placementError(sim, 1, 'airlock', 9, 5, 1)) throw new Error('airlock does not fit');
    spawnModule(sim, 'airlock', 9, 5, 1);
  }
  if (o.lifeSupport) {
    const ls = spawnModule(sim, 'lifeSupport', 4, 4, 0);
    const m = sim.world.get(ls, ModuleC)!;
    m.powered = true;
    m.enabled = true;
  }
  return sim;
}

export function crew(sim: Sim, x: number, y: number, o: { drafted?: boolean; species?: string } = {}): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: o.species ?? 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...all4 });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  if (o.drafted) sim.world.add(id, DraftedC, { target: null });
  return id;
}

export function run(sim: Sim, n: number, events: SimEvent[] = []): SimEvent[] {
  for (let i = 0; i < n; i++) {
    sim.step();
    events.push(...sim.events.drain());
  }
  return events;
}

export const airlockOf = (sim: Sim): number => sim.world.query(AirlockC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === 1) as number;

/** A player shuttle of ship 1 hovering `x` sector tiles off its west hull at row 6.5 (within float range of a hull tile), or docked/stowed per `state`. */
export function shuttle(sim: Sim, state: 'flying' | 'docked' | 'stowed' = 'flying', x = -3): number {
  const v = sim.world.createEntity();
  sim.world.add(v, VehicleC, {
    def: 'vehicle.shuttle', homeShip: 1, home: 0, state, hp: 90, pilot: 0, passengers: [], dest: null, dock: state === 'docked' ? airlockOf(sim) : 0, cargo: [],
    ...(state === 'flying' ? { hover: 1 } : {}),
  });
  sim.world.add(v, BodyC, { x, y: 6.5, heading: 0, alt: state === 'stowed' ? ALT.stowed : ALT.cruise });
  return v;
}
