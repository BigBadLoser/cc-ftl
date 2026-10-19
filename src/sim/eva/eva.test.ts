import { describe, expect, it } from 'vitest';
import { CombatC, ShipC } from '../combat/components';
import {
  CrewC, DraftedC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import { findPath } from '../crew/pathfind';
import type { SimEvent } from '../events';
import { hitChance } from '../fight/weapons';
import { ModuleC } from '../modules/components';
import { placementError, spawnModule } from '../modules/spawn';
import { AirlockC, CrossingC, PortalC, SuitC } from '../portals/components';
import type { ContentRegistry, ModuleDef } from '../registry';
import { deserialize, serialize } from '../save';
import { gridFromTemplate } from '../ship';
import { Sim } from '../sim';
import { stat } from '../stats';
import { Struct } from '../structure';
import { CREW_MAX_HP, DEFAULT_SUIT } from '../tuning';
import { airlockSuits, suitAir } from './suit';
import { planWalk } from './route';

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

/** Ship 1 at sector (20, 20) with its airlock on the east hull, ship 2 (optional) 5 tiles away with its airlock on the west hull. */
function world(ships = 1, gap = 5): Sim {
  const sim = new Sim(7, content);
  const rots = [1, 3];
  for (let g = 1; g <= ships; g++) {
    sim.grids.set(g, gridFromTemplate(g, { name: `s${g}`, rows: ring() }));
    const rot = rots[g - 1] as number;
    const at = rot === 1 ? { x: 9, y: 5 } : { x: 1, y: 5 };
    expect(placementError(sim, g, 'airlock', at.x, at.y, rot)).toBeNull();
    spawnModule(sim, g, 'airlock', at.x, at.y, rot);
    const ship = sim.world.createEntity();
    sim.world.add(ship, ShipC, {
      gridId: g, name: `s${g}`, faction: 'player', state: 'active', x: 20 + (g - 1) * (14 + gap - 1), y: 20, width: 14, height: 14, hullMax: 0, integrity: 1,
    });
    sim.world.add(ship, CombatC, { hold: false, volley: false, target: null, doctrine: 'random', ftl: 0, shield: { layers: 0, max: 0, timer: 0 }, evasion: 0, aiTimer: 0 });
  }
  return sim;
}
function crew(sim: Sim, gridId: number, x: number, y: number, o: { drafted?: boolean; species?: string; prio?: Priorities } = {}): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: o.species ?? 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId, x, y, toX: x, toY: y, progress: 0, facing: 0 });
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
const airlockOf = (sim: Sim, gridId: number): number => sim.world.query(AirlockC).find((id) => sim.world.get(id, ModuleC)!.gridId === gridId) as number;
/** Hold the vented patches empty and the rest of the ship at full pressure (a breach plus working life support). */
const drain = (sim: Sim): void => {
  const patch = vacuum.get(sim);
  if (!patch) return;
  const g = sim.grids.get(1)!;
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

  it('crew suit up on their own for a job in a vented room, do it, and put the suit back', () => {
    const sim = world();
    const lock = airlockOf(sim, 1);
    const c = crew(sim, 1, 3, 3);
    vent(sim, 3, 7, 7, 11);
    run(sim, 2);
    sim.enqueue({ type: 'job.build', gridId: 1, x: 5, y: 9, struct: Struct.Wall });
    const ev = run(sim, 20 * 60);
    expect(ev.filter((e) => e.type === 'suit.donned')).toHaveLength(1);
    expect(ev.some((e) => e.type === 'crew.jobDone')).toBe(true);
    expect(sim.grids.get(1)!.get('struct', 5, 9)).toBe(Struct.Wall);
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
    sim.enqueue({ type: 'job.build', gridId: 1, x: 5, y: 9, struct: Struct.Wall }); // 2 steps away, deep in the vacuum
    sim.enqueue({ type: 'job.build', gridId: 1, x: 10, y: 3, struct: Struct.Wall }); // 5 steps away, clean air
    run(sim, 3);
    const mine = [...sim.world.query(JobC)].map((j) => sim.world.get(j, JobC)!).find((j) => j.reservedBy === c);
    expect(mine && [mine.x, mine.y]).toEqual([10, 3]);
    // No suit anywhere: the vented job is never taken, and nobody is hurt.
    const sim2 = world();
    sim2.world.get(airlockOf(sim2, 1), AirlockC)!.suits = 0;
    const d = crew(sim2, 1, 5, 6);
    vent(sim2, 3, 7, 7, 11);
    run(sim2, 2);
    sim2.enqueue({ type: 'job.build', gridId: 1, x: 5, y: 9, struct: Struct.Wall });
    run(sim2, 20 * 20);
    expect(sim2.grids.get(1)!.get('struct', 5, 9)).not.toBe(Struct.Wall);
    expect(sim2.world.get(d, HealthC)!.hp).toBe(CREW_MAX_HP);
    expect(lock).toBeGreaterThan(0);
  });
});

describe('floating between ships', () => {
  const portals = (sim: Sim): { kind: string; ticks: number; cost: number; requires: unknown[] }[] =>
    sim.world.query(PortalC).map((id) => sim.world.get(id, PortalC)!);
  /** Both ships, one suited drafted crew member ordered over to ship 2. */
  function crossing(): { sim: Sim; c: number } {
    const sim = world(2);
    const c = crew(sim, 1, 6, 6, { drafted: true });
    sim.enqueue({ type: 'suit.set', crew: c, worn: true });
    run(sim, 41); // the link system runs at tick 40
    sim.enqueue({ type: 'crew.moveTo', id: c, x: 6, y: 6, gridId: 2 });
    return { sim, c };
  }

  it('links airlocks within suit range, and drops the link when a ship drifts away', () => {
    const sim = world(2);
    run(sim, 45);
    const [p] = portals(sim);
    expect(portals(sim)).toHaveLength(1);
    expect(p).toMatchObject({ kind: 'eva', ticks: Math.round((5 / DEFAULT_SUIT.floatSpeed) * 20), requires: [{ type: 'suit' }] });
    const ship = sim.world.query(ShipC).map((id) => sim.world.get(id, ShipC)!).find((s) => s.gridId === 2)!;
    ship.x += 10;
    run(sim, 45);
    expect(portals(sim)).toHaveLength(0);
    expect(portals(world(1))).toHaveLength(0);
  });

  it('a suited crew member floats across, draining air, and arrives on the other ship', () => {
    const { sim, c } = crossing();
    const ev: SimEvent[] = [];
    let floated = false;
    for (let i = 0; i < 1500 && sim.world.get(c, PositionC)!.gridId === 1; i++) {
      run(sim, 1, ev);
      if (sim.world.has(c, CrossingC)) floated = true;
    }
    expect(floated).toBe(true);
    run(sim, 200, ev);
    expect(sim.world.get(c, PositionC)).toMatchObject({ gridId: 2, x: 6, y: 6 });
    expect(ev.filter((e) => e.type === 'crew.crossed')).toEqual([expect.objectContaining({ kind: 'eva', fromGridId: 1, toGridId: 2 })]);
    // The tank lost about the crossing time, not more (the airlocks hold air).
    expect(suitAir(sim, c)).toBeLessThan(DEFAULT_SUIT.airSec);
    expect(suitAir(sim, c)).toBeGreaterThan(DEFAULT_SUIT.airSec - 40);
    expect(sim.world.get(c, HealthC)!.hp).toBe(CREW_MAX_HP);
    // Taking the suit off over there stows it in that airlock.
    sim.enqueue({ type: 'eva.suitOff', crew: c });
    run(sim, 300);
    expect(sim.world.has(c, SuitC)).toBe(false);
    expect(airlockSuits(sim, airlockOf(sim, 1))).toBe(3);
    expect(airlockSuits(sim, airlockOf(sim, 2))).toBe(4);
  });

  it('crew without a suit cannot cross open space', () => {
    const sim = world(2);
    const c = crew(sim, 1, 6, 6, { drafted: true });
    run(sim, 41);
    sim.enqueue({ type: 'crew.moveTo', id: c, x: 6, y: 6, gridId: 2 });
    run(sim, 600);
    expect(sim.world.get(c, PositionC)!.gridId).toBe(1);
    expect(sim.world.get(c, DraftedC)!.target).toBeNull();
  });

  it('an empty tank mid-crossing hurts like vacuum', () => {
    const { sim, c } = crossing();
    sim.world.get(c, SuitC)!.air = 1;
    run(sim, 20 * 25);
    expect(suitAir(sim, c)).toBe(0);
    expect(sim.world.get(c, HealthC)!.hp).toBeLessThan(CREW_MAX_HP);
  });

  it('is deterministic, and a save taken mid-float continues the same', () => {
    const a = crossing();
    let n = 0;
    while (!a.sim.world.has(a.c, CrossingC)) {
      run(a.sim, 1);
      n++;
    }
    run(a.sim, 10);
    n += 10;
    const saved = serialize(a.sim);
    run(a.sim, 200);
    const b = crossing();
    run(b.sim, n + 200);
    expect(serialize(b.sim)).toBe(serialize(a.sim));
    const loaded = deserialize(saved, content);
    expect(loaded.world.has(a.c, CrossingC)).toBe(true);
    run(loaded, 200);
    expect(serialize(loaded)).toBe(serialize(a.sim));
  });
});
