import { describe, expect, it } from 'vitest';

import { ALT, BodyC } from '../body';

import { CombatC } from '../combat/components';
import {
  CrewC, DraftedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';

import type { SimEvent } from '../events';
import { ModuleC } from '../modules/components';

import { placementError, spawnModule } from '../modules/spawn';

import { SuitC } from './components';

import { AirlockC } from '../modules/airlock';

import { AboardC, VehicleC } from '../vehicles/components';

import { EvaFloatC } from './components';

import type { ContentRegistry, ModuleDef } from '../registry';
import { serialize } from '../save';

import { stampShip } from '../combat/ships';

import { shipGrid } from '../regions';

import { Sim } from '../sim';

import { Struct } from '../structure';

import { CREW_MAX_HP, DEFAULT_SUIT } from '../tuning';

import { suitAir } from './suit';

import { shipIdOf } from '../regions';


// The docking airlock of content/modules.ts, powered by nothing (power 0 counts as running).
const airlockDef: ModuleDef = {
  name: 'Airlock', asset: 'a', footprint: [3, 4], solid: true, power: 0, flammability: 0.1, maxHp: 120, buildWork: 20, hullEdge: 'n',
  openTiles: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [2, 3]],
  airlock: {
    cycleSec: 2, suits: 3,
    layout: {
      outer: [1, 0], inner: [1, 1], inside: [1, 2], collar: [1, -1],
      unloaders: [{ tiles: [[0, 1], [0, 2]], chute: [0, 2], stand: [0, 3] }, { tiles: [[2, 1], [2, 2]], chute: [2, 2], stand: [2, 3] }],
    },
  },
};
const content: ContentRegistry = {
  ships: {}, roles: {}, crewNames: [], items: {}, recipes: {}, structCosts: {},
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 },
    'species.robot': { name: 'R', moveSpeed: 2, workSpeed: 1, restDecay: 0, airless: true },
  },
  modules: { airlock: airlockDef },
};
const all4: Priorities = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 4, hauling: 4, crafting: 4, cooking: 4 };

/** A 14x14 ship: hull ring, 10x10 floor. */
function ring(): string[] {
  const rows = ['.'.repeat(14), '.' + '#'.repeat(12) + '.'];
  for (let i = 0; i < 10; i++) rows.push('.#' + '_'.repeat(10) + '#.');
  rows.push('.' + '#'.repeat(12) + '.', '.'.repeat(14));
  return rows;
}

/**
 * Ship 1 stamped at the sector origin (so its local tiles are sector tiles) with its airlock on the east hull, ship 2 (optional) `gap` tiles away (or at `at2`) with its
 * airlock on the west hull. Each window sits at its ShipC position.
 */
function world(ships = 1, gap = 5, at2?: { x: number; y: number }): Sim {
  const sim = new Sim(7, content);
  const rots = [1, 3];
  const origins: { x: number; y: number }[] = [];
  // Ships first, so their ids are 1 and 2 (the first entities); then each airlock.
  for (let g = 1; g <= ships; g++) {
    const origin = g === 1 ? { x: 0, y: 0 } : (at2 ?? { x: (g - 1) * (14 + gap - 1), y: 0 });
    origins.push(origin);
    const ship = stampShip(sim, { name: `s${g}`, rows: ring() }, { faction: 'player', x: origin.x, y: origin.y });
    sim.world.add(ship, CombatC, { hold: false, volley: false, target: null, doctrine: 'random', ftl: 0, shield: { layers: 0, max: 0, timer: 0 }, evasion: 0, aiTimer: 0 });
  }
  for (let g = 1; g <= ships; g++) {
    const origin = origins[g - 1] as { x: number; y: number };
    const rot = rots[g - 1] as number;
    const at = rot === 1 ? { x: origin.x + 9, y: origin.y + 5 } : { x: origin.x + 1, y: origin.y + 5 }; // sector tiles
    expect(placementError(sim, g, 'airlock', at.x, at.y, rot)).toBeNull();
    spawnModule(sim, 'airlock', at.x, at.y, rot);
  }
  return sim;
}
function crew(sim: Sim, shipId: number, x: number, y: number, o: { drafted?: boolean; species?: string; prio?: Priorities } = {}): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: o.species ?? 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...(o.prio ?? all4) });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  if (o.drafted) sim.world.add(id, DraftedC, { target: null });
  return id;
}
function run(sim: Sim, n: number, events: SimEvent[] = []): SimEvent[] {
  for (let i = 0; i < n; i++) {
    drain(sim); // a breach that keeps its patch empty, before and after the tick
    sim.step();
    drain(sim);
    events.push(...sim.events.drain());
  }
  return events;
}
const airlockOf = (sim: Sim, shipId: number): number => sim.world.query(AirlockC).find((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId) as number;
/** Hold the vented patches empty and the rest of the ship at full pressure (a breach plus working life support). */
const drain = (sim: Sim): void => {
  const patch = vacuum.get(sim);
  if (!patch) return;
  const g = shipGrid(sim, 1)!;
  for (let y = 2; y < 12; y++) for (let x = 2; x < 12; x++) g.set('o2', x, y, patch.some(([px, py]) => px === x && py === y) ? 0 : 21);
};
const vacuum = new WeakMap<Sim, number[][]>();


const shuttleDef = { name: 'S', class: 'shuttle', asset: 's', speed: 5, maxHp: 90, capacity: 4, evasion: 0, eva: { suits: 2, hoverGap: 4.5 } };
content.vehicles = { 'vehicle.shuttle': shuttleDef };

/** Ships 1 and 2 far apart (ship 2 at sector (100, 50)); a shuttle of ship 1 flying with a pilot and two passengers. */
function setup(): { sim: Sim; v: number; pilot: number; a: number; b: number; target: number } {
  const sim = world(2, 5, { x: 100, y: 50 });
  const pilot = crew(sim, 1, 4, 4);
  const a = crew(sim, 1, 5, 4);
  const b = crew(sim, 1, 6, 4);
  const v = sim.world.createEntity();
  sim.world.add(v, VehicleC, {
    def: 'vehicle.shuttle', homeShip: 1, home: 0, state: 'flying', hp: 90, pilot, passengers: [a, b], dest: null, dock: 0, cargo: [],
  });
  sim.world.add(v, BodyC, { x: 40, y: 30, heading: 0, alt: ALT.cruise });
  for (const c of [pilot, a, b]) {
    sim.world.remove(c, PositionC);
    sim.world.remove(c, PathC);
    sim.world.add(c, AboardC, { vehicle: v });
  }
  return { sim, v, pilot, a, b, target: 2 };
}
const reasons = (ev: SimEvent[]): string[] => ev.filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason);

describe('EVA from a hovering shuttle', () => {
  it('hovers a couple of tiles off the target hull, then puts passengers out in suits that float to the hull', () => {
    const { sim, v, a, b, pilot } = setup();
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: 2 });
    run(sim, 20 * 30);
    const veh = sim.world.get(v, VehicleC)!;
    expect(veh).toMatchObject({ hover: 2, dest: null });
    expect(sim.world.get(v, BodyC)!.x).toBeCloseTo(100 - 4.5); // 4.5 tiles off the west side of ship 2
    sim.enqueue({ type: 'eva.out', vehicle: v });
    const ev = run(sim, 1);
    expect(reasons(ev)).toEqual([]);
    expect(veh.suits).toBe(0);
    expect(veh.passengers).toEqual([]);
    expect(veh.pilot).toBe(pilot);
    for (const c of [a, b]) {
      expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(2);
      expect(sim.world.get(c, SuitC)).toMatchObject({ worn: true, vehicle: v });
      expect(sim.world.has(c, EvaFloatC)).toBe(true);
      const p = sim.world.get(c, PositionC)!;
      expect(shipGrid(sim, 2)!.get('struct', p.x, p.y)).toBe(Struct.Space);
    }
    // The drift runs in sector space: from the shuttle's hull-facing side (2.6 tiles off its body) to the landing tile.
    const body = sim.world.get(v, BodyC)!;
    const f = sim.world.get(a, EvaFloatC)!;
    expect(Math.hypot(f.sx - body.x, f.sy - body.y)).toBeCloseTo(2.6);
    const p0 = { ...sim.world.get(a, PositionC)! };
    expect(f.sx).toBeLessThan(100 + p0.x + 0.5); // ship 2's tile p0 is at sector x 100 + p0.x + 0.5, east of the hatch
    run(sim, 10);
    expect(sim.world.get(a, PositionC)).toMatchObject({ x: p0.x, y: p0.y }); // frozen while drifting, no grid change
    expect(shipIdOf(sim, sim.world.get(a, PositionC))).toBe(2);
    run(sim, 20 * 6);
    expect(sim.world.has(a, EvaFloatC)).toBe(false);
    expect(suitAir(sim, a)).toBeLessThan(DEFAULT_SUIT.airSec);
    expect(sim.world.get(a, HealthC)!.hp).toBe(CREW_MAX_HP);
    // The shuttle cannot leave while crew are out.
    sim.enqueue({ type: 'vehicle.dock', vehicle: v, airlock: airlockOf(sim, 2) });
    expect(reasons(run(sim, 2))).toEqual(['crewOutside']);
  });

  it('crew float back, board and stow the suit; a third suit does not exist', () => {
    const { sim, v, a, b } = setup();
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: 2 });
    run(sim, 20 * 30);
    sim.enqueue({ type: 'eva.out', vehicle: v, crew: a });
    run(sim, 20 * 8);
    sim.enqueue({ type: 'crew.draft', id: a, drafted: true });
    sim.enqueue({ type: 'eva.board', crew: a, vehicle: v });
    run(sim, 1);
    const back = sim.world.get(a, EvaFloatC)!;
    const body = sim.world.get(v, BodyC)!;
    expect(back.mode).toBe('back');
    expect(Math.hypot(back.sx - body.x, back.sy - body.y)).toBeCloseTo(2.6);
    const ev = run(sim, 20 * 8);
    expect(reasons(ev)).toEqual([]);
    const veh = sim.world.get(v, VehicleC)!;
    expect(veh.passengers).toContain(a);
    expect(sim.world.has(a, SuitC)).toBe(false);
    expect(sim.world.has(a, PositionC)).toBe(false);
    expect(veh.suits).toBe(2); // 2 stowed, one used, one back
    sim.enqueue({ type: 'eva.out', vehicle: v });
    run(sim, 1);
    expect(sim.world.get(b, SuitC)).toBeDefined();
  });

  it('refuses out of range, without a hover, and with no suits left', () => {
    const { sim, v } = setup();
    sim.enqueue({ type: 'eva.out', vehicle: v });
    expect(reasons(run(sim, 1))).toEqual(['notHovering']);
    sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: 2 });
    run(sim, 20 * 30);
    const veh = sim.world.get(v, VehicleC)!;
    veh.suits = 0;
    sim.enqueue({ type: 'eva.out', vehicle: v });
    expect(reasons(run(sim, 1))).toEqual(['noSuit']);
    veh.suits = 2;
    sim.world.get(v, BodyC)!.x -= 10; // drifted off
    sim.enqueue({ type: 'eva.out', vehicle: v });
    expect(reasons(run(sim, 1))).toEqual(['outOfRange']);
  });

  it('is deterministic', () => {
    const go = (): string => {
      const { sim, v } = setup();
      sim.enqueue({ type: 'vehicle.hover', vehicle: v, ship: 2 });
      run(sim, 20 * 30);
      sim.enqueue({ type: 'eva.out', vehicle: v });
      run(sim, 100);
      return serialize(sim);
    };
    expect(go()).toBe(go());
  });
});
