import { newHeat } from '../combat/heat';
import { describe, expect, it } from 'vitest';

import { CombatC } from '../combat/components';
import {
  CrewC, DraftedC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';

import { findPath } from '../crew/pathfind';

import type { SimEvent } from '../events';
import { hitChance } from '../fight/weapons';

import { ModuleC } from '../modules/components';

import { placementError, spawnModule } from '../modules/spawn';

import { SuitC } from './components';

import { AirlockC } from '../modules/airlock';

import type { ContentRegistry, ModuleDef } from '../registry';
import { deserialize, serialize } from '../save';

import { stampShip } from '../combat/ships';

import { shipGrid } from '../regions';

import { Sim } from '../sim';


import { stat } from '../stats';

import { Struct } from '../structure';

import { CREW_MAX_HP, DEFAULT_SUIT } from '../tuning';

import { airlockTiles } from '../modules/airlock';

import { isEvaWalkable } from '../structure';

import { airlockSuits, suitAir } from './suit';

import { planSiteWalk, planWalk } from './route';

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
const all4: Priorities = { firefighting: 4, medical: 4, operating: 4, repair: 4, construction: 4, hauling: 4, refining: 4, crafting: 4, research: 4, cooking: 4, patrol: 0 };

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
    sim.world.add(ship, CombatC, { hold: false, volley: false, target: null, doctrine: 'random', ftl: 0, shield: { layers: 0, max: 0, timer: 0 }, heat: newHeat(), evasion: 0, pilot: 0, cruisePilot: 0, cruiseEvasion: 0, aiTimer: 0 });
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
const vent = (sim: Sim, x0: number, y0: number, x1: number, y1: number): void => {
  const list = vacuum.get(sim) ?? [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) list.push([x, y]);
  vacuum.set(sim, list);
};

describe('suits at the airlock', () => {
  it('a drafted crew member walks to the airlock, puts a suit on and the airlock has one fewer', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const c = crew(sim, 1, 4, 4, { drafted: true });
    expect(airlockSuits(sim, lock)).toBe(3);
    sim.enqueue({ type: 'eva.suitUp', crew: c, airlock: lock });
    const ev = run(sim, 40);
    expect(sim.world.has(c, SuitC)).toBe(false); // still walking / fitting
    run(sim, 200, ev);
    expect(sim.world.get(c, SuitC)).toEqual({ worn: true, air: DEFAULT_SUIT.airSec, airlock: lock });
    expect(airlockSuits(sim, lock)).toBe(2);
    expect(ev.filter((e) => e.type === 'suit.donned')).toEqual([{ type: 'suit.donned', crew: c, airlock: lock }]);
    expect(sim.world.query(JobC)).toHaveLength(0);
  });

  it('puts the suit back, with a full tank, at the airlock where it is taken off', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const c = crew(sim, 1, 4, 4, { drafted: true });
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 2);
    sim.world.get(c, SuitC)!.air = 12;
    sim.enqueue({ type: 'eva.suitOff', crew: c });
    const ev = run(sim, 240);
    expect(sim.world.has(c, SuitC)).toBe(false);
    expect(airlockSuits(sim, lock)).toBe(4); // suit.set made one from nowhere; stowing returns it to the airlock
    expect(ev.some((e) => e.type === 'suit.doffed')).toBe(true);
  });

  it('refuses when the airlock has no free suit, for robots, for suited and for undrafted crew', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const bot = crew(sim, 1, 4, 4, { drafted: true, species: 'species.robot' });
    const idle = crew(sim, 1, 5, 4);
    const a = crew(sim, 1, 6, 4, { drafted: true });
    sim.world.get(lock, AirlockC)!.suits = 0;
    sim.enqueue({ type: 'eva.suitUp', crew: bot, airlock: lock });
    sim.enqueue({ type: 'eva.suitUp', crew: idle, airlock: lock });
    sim.enqueue({ type: 'eva.suitUp', crew: a, airlock: lock });
    const ev = run(sim, 2);
    expect(ev.filter((e) => e.type === 'command.rejected').map((e) => (e as { reason: string }).reason)).toEqual(['airless', 'notDrafted', 'noSuit']);
    sim.world.get(lock, AirlockC)!.suits = 1;
    sim.enqueue({ type: 'eva.suitUp', crew: a, airlock: lock });
    sim.enqueue({ type: 'eva.suitOff', crew: a });
    expect(run(sim, 2).some((e) => e.type === 'command.rejected' && (e as { reason: string }).reason === 'notSuited')).toBe(true);
  });

  it('a suit is limited: the last one goes to the first crew member there', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    sim.world.get(lock, AirlockC)!.suits = 1;
    const a = crew(sim, 1, 4, 4, { drafted: true });
    const b = crew(sim, 1, 5, 4, { drafted: true });
    sim.enqueue({ type: 'eva.suitUp', crew: a, airlock: lock });
    sim.enqueue({ type: 'eva.suitUp', crew: b, airlock: lock });
    const ev = run(sim, 2);
    expect(ev.filter((e) => e.type === 'command.rejected')).toHaveLength(1);
  });
});

describe('suit air', () => {
  it('drains only in thin air, runs out, then hurts like vacuum; a bare crew member beside it is hurt at once', () => {
    const sim = world();
    const suited = crew(sim, 1, 4, 4, { drafted: true });
    const bare = crew(sim, 1, 5, 4, { drafted: true });
    sim.enqueue({ type: 'suit.set', crew: suited, worn: true });
    run(sim, 20 * 5);
    expect(suitAir(sim, suited)).toBe(DEFAULT_SUIT.airSec); // breathable air: the tank is untouched
    vent(sim, 3, 3, 6, 5);
    const ev = run(sim, 20 * 10);
    expect(suitAir(sim, suited)).toBeCloseTo(DEFAULT_SUIT.airSec - 10, 0);
    expect(sim.world.get(suited, HealthC)!.hp).toBe(CREW_MAX_HP);
    expect(sim.world.get(bare, HealthC)!.hp).toBeLessThan(CREW_MAX_HP);
    sim.world.get(suited, SuitC)!.air = 3;
    run(sim, 20 * 6, ev);
    expect(suitAir(sim, suited)).toBe(0);
    expect(ev.filter((e) => e.type === 'suit.airOut')).toHaveLength(1);
    const hp = sim.world.get(suited, HealthC)!.hp;
    run(sim, 20 * 5);
    expect(sim.world.get(suited, HealthC)!.hp).toBeLessThan(hp);
  });

  it('warns once when the tank falls to a quarter', () => {
    const sim = world();
    const c = crew(sim, 1, 4, 4, { drafted: true });
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    vent(sim, 3, 3, 5, 5);
    run(sim, 2);
    sim.world.get(c, SuitC)!.air = DEFAULT_SUIT.airSec * 0.25 + 0.5;
    const ev = run(sim, 20 * 3);
    expect(ev.filter((e) => e.type === 'suit.airLow')).toHaveLength(1);
  });

  it('suited crew are slower and hit less often; robots never wear one', () => {
    const sim = world();
    const c = crew(sim, 1, 4, 4);
    const before = stat(sim, c, 'moveSpeed');
    const work = stat(sim, c, 'workSpeed');
    const hit = hitChance(sim, c, { kind: 'melee', damage: 5, range: 1, cooldownSec: 1, accuracy: 0.7 }, 1, 'none');
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 1);
    expect(stat(sim, c, 'moveSpeed')).toBeCloseTo(before * DEFAULT_SUIT.moveMult);
    expect(stat(sim, c, 'workSpeed')).toBeCloseTo(work * DEFAULT_SUIT.workMult);
    expect(hitChance(sim, c, { kind: 'melee', damage: 5, range: 1, cooldownSec: 1, accuracy: 0.7 }, 1, 'none')).toBeCloseTo(hit * DEFAULT_SUIT.accuracyMult);
  });
});

describe('pathing', () => {
  it('prefers a longer walk that keeps out of thin air, and flags a walk that cannot', () => {
    const sim = world();
    const c = crew(sim, 1, 3, 6);
    vent(sim, 7, 2, 7, 10); // a vented band across the room, with a gap at y = 11
    run(sim, 2);
    const direct = findPath(sim, 1, { x: 3, y: 6 }, { x: 10, y: 6 })!;
    const plan = planWalk(sim, c, 1, { x: 3, y: 6 }, { x: 10, y: 6 })!;
    expect(plan.thin).toBe(false);
    expect(plan.steps.length).toBeGreaterThan(direct.length);
    expect(plan.steps.some((s) => s.x === 7 && s.y === 11)).toBe(true);
    vent(sim, 7, 11, 7, 11);
    run(sim, 2);
    expect(planWalk(sim, c, 1, { x: 3, y: 6 }, { x: 10, y: 6 })!.thin).toBe(true);
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 1);
    expect(planWalk(sim, c, 1, { x: 3, y: 6 }, { x: 10, y: 6 })!.thin).toBe(false);
  });

  it('a caller with no use for a thin-air plan gets none, and no search is spent on it (#224)', () => {
    const sim = world();
    const c = crew(sim, 1, 3, 6);
    vent(sim, 7, 2, 7, 11); // a vented band with no gap: the far side is reachable only through thin air
    run(sim, 2);
    const goal = { x: 10, y: 6 };
    expect(planWalk(sim, c, 1, { x: 3, y: 6 }, goal)!.thin).toBe(true);
    expect(planWalk(sim, c, 1, { x: 3, y: 6 }, goal, () => false)).toBeNull();
    expect(planSiteWalk(sim, c, 1, { x: 3, y: 6 }, goal, () => false)).toBeNull();
    expect(planSiteWalk(sim, c, 1, { x: 3, y: 6 }, goal, () => true)!.thin).toBe(true);
  });

  it('crew suit up on their own for a job in a vented room, do it, and put the suit back', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const c = crew(sim, 1, 3, 3);
    vent(sim, 3, 7, 7, 11);
    run(sim, 2);
    sim.enqueue({ type: 'job.build', ship: 1, x: 5, y: 9, struct: Struct.Wall });
    const ev = run(sim, 20 * 60);
    expect(ev.filter((e) => e.type === 'suit.donned')).toHaveLength(1);
    expect(ev.some((e) => e.type === 'crew.jobDone')).toBe(true);
    expect(shipGrid(sim, 1)!.get('struct', 5, 9)).toBe(Struct.Wall);
    expect(sim.world.get(c, HealthC)!.hp).toBe(CREW_MAX_HP);
    run(sim, 20 * 30, ev);
    expect(ev.filter((e) => e.type === 'suit.doffed')).toHaveLength(1);
    expect(sim.world.has(c, SuitC)).toBe(false);
    expect(airlockSuits(sim, lock)).toBe(3);
  });

  it('prefer a job that needs no EVA over a nearer one that does, and skip vented jobs when no suit is free', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const c = crew(sim, 1, 5, 6);
    vent(sim, 3, 7, 7, 11);
    run(sim, 2);
    sim.enqueue({ type: 'job.build', ship: 1, x: 5, y: 9, struct: Struct.Wall }); // 2 steps away, deep in the vacuum
    sim.enqueue({ type: 'job.build', ship: 1, x: 10, y: 3, struct: Struct.Wall }); // 5 steps away, clean air
    run(sim, 3);
    const mine = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!).find((j) => j.reservedBy === c);
    expect(mine && [mine.x, mine.y]).toEqual([10, 3]);
    // No suit anywhere: the vented job is never taken, and nobody is hurt.
    const sim2 = world();
    sim2.world.get(airlockOf(sim2, 1), AirlockC)!.suits = 0;
    const d = crew(sim2, 1, 5, 6);
    vent(sim2, 3, 7, 7, 11);
    run(sim2, 2);
    sim2.enqueue({ type: 'job.build', ship: 1, x: 5, y: 9, struct: Struct.Wall });
    run(sim2, 20 * 20);
    expect(shipGrid(sim2, 1)!.get('struct', 5, 9)).not.toBe(Struct.Wall);
    expect(sim2.world.get(d, HealthC)!.hp).toBe(CREW_MAX_HP);
    expect(lock).toBeGreaterThan(0);
  });
});

describe('outside on the hull', () => {
  const collar = (sim: Sim): { x: number; y: number } => airlockTiles(airlockDef, sim.world.get(airlockOf(sim, 1), ModuleC)!).collar!;

  it('a suited crew member walks out through the airlock onto the hull, draining air, and back in', () => {
    const sim = world();
    const c = crew(sim, 1, 6, 6, { drafted: true });
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    const out = { x: collar(sim).x, y: collar(sim).y + 1 }; // a hull-side tile beside the collar
    sim.enqueue({ type: 'crew.moveTo', id: c, x: out.x, y: out.y });
    run(sim, 20 * 30);
    expect(sim.world.get(c, PositionC)).toMatchObject({ x: out.x, y: out.y });
    expect(shipIdOf(sim, sim.world.get(c, PositionC))).toBe(1);
    expect(shipGrid(sim, 1)!.get('struct', out.x, out.y)).toBe(Struct.Space);
    expect(suitAir(sim, c)).toBeLessThan(DEFAULT_SUIT.airSec);
    expect(sim.world.get(c, HealthC)!.hp).toBe(CREW_MAX_HP);
    sim.enqueue({ type: 'crew.moveTo', id: c, x: 6, y: 6 });
    run(sim, 20 * 30);
    expect(sim.world.get(c, PositionC)).toMatchObject({ x: 6, y: 6 });
  });

  it('crew without a suit cannot be ordered outside, and the exterior is only the ring touching the hull', () => {
    const sim = world();
    const c = crew(sim, 1, 6, 6, { drafted: true });
    const at = collar(sim);
    sim.enqueue({ type: 'crew.moveTo', id: c, x: at.x, y: at.y });
    const ev = run(sim, 2);
    expect(ev.some((e) => e.type === 'command.rejected' && (e as { reason: string }).reason === 'notWalkable')).toBe(true);
    const g = shipGrid(sim, 1)!;
    expect(isEvaWalkable(g, at.x, at.y)).toBe(true);
    expect(isEvaWalkable(g, 0, 0)).toBe(true); // diagonal to the hull corner
    expect(isEvaWalkable(g, 6, 6)).toBe(false); // floor
  });

  it('suited crew keep to the inside unless it is far longer: an inside route up to ~3x longer still wins', () => {
    const sim = world();
    const c = crew(sim, 1, 2, 2);
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    for (let x = 2; x <= 10; x++) sim.enqueue({ type: 'debug.setStruct', ship: 1, x, y: 3, kind: Struct.Wall });
    for (const y of [2, 4]) sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 1, y, kind: Struct.Space }); // breaches: a short way round outside
    run(sim, 2);
    const g = shipGrid(sim, 1)!;
    const outside = (steps: { x: number; y: number }[]): boolean => steps.some((s) => g.get('struct', s.x, s.y) === Struct.Space);
    const inside = planWalk(sim, c, 1, { x: 2, y: 2 }, { x: 2, y: 4 })!;
    expect(outside(inside.steps)).toBe(false);
    expect(inside.steps.length).toBeGreaterThan(14); // about 3x the 6 steps outside
    // With the inside way shut, the route goes outside.
    sim.enqueue({ type: 'debug.setStruct', ship: 1, x: 11, y: 3, kind: Struct.Wall });
    run(sim, 2);
    expect(outside(planWalk(sim, c, 1, { x: 2, y: 2 }, { x: 2, y: 4 })!.steps)).toBe(true);
  });

  it('is deterministic', () => {
    const go = (): string => {
      const sim = world();
      const c = crew(sim, 1, 6, 6, { drafted: true });
      sim.enqueue({ type: 'suit.set', crew: c, worn: true });
      sim.enqueue({ type: 'crew.moveTo', id: c, x: collar(sim).x, y: collar(sim).y });
      run(sim, 400);
      return serialize(sim);
    };
    expect(go()).toBe(go());
    const sim = deserialize(go(), content);
    expect(sim.world.query(SuitC)).toHaveLength(1);
  });
});
