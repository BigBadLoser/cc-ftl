import { describe, expect, it } from 'vitest';
import { stampShip } from '../combat/ships';
import { CrewC, DeadC, DownedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import type { SimEvent } from '../events';
import { AllegianceC, EquipC } from '../fight/components';
import { shipIdOf } from '../regions';
import type { ContentRegistry, ShipTemplate } from '../registry';
import { serialize } from '../save';
import { Sim } from '../sim';
import { CREW_MAX_HP, SAC_STAGE_SEC } from '../tuning';
import { TICK_HZ } from '../time';
import { AlienC, EggSacC, NestC } from './components';
import { laySac, spawnAlien } from './spawn';

const NONE = {} as Priorities;
const alien = { moveSpeed: 3.6, workSpeed: 0, restDecay: 0, airless: true, fearless: true, creature: { fleeBelow: 0.25 } } as const;
const content: ContentRegistry = {
  ships: {},
  roles: {
    'role.civ': { name: 'Civ', priorities: NONE },
    'role.sec': { name: 'Sec', priorities: NONE, skills: { gunnery: 2 }, fighter: true },
    'role.hunter': { name: 'Hunter', species: 'species.hunter', priorities: NONE },
    'role.spitter': { name: 'Spitter', species: 'species.spitter', priorities: NONE },
  },
  species: {
    'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0 },
    'species.hunter': { ...alien, name: 'Hunter', maxHp: 60, natural: { id: 'claws', kind: 'melee', range: 1, damage: 9, cooldownSec: 0.9, accuracy: 0.75 } },
    'species.spitter': { ...alien, name: 'Spitter', maxHp: 45, creature: { fleeBelow: 0.3, keepAway: 4 }, natural: { id: 'spit', kind: 'ranged', range: 7, damage: 8, cooldownSec: 2.4, accuracy: 0.6 } },
  },
  modules: {},
  crewNames: [],
  items: {
    'item.rifle': { name: 'R', tags: [], stackSize: 5, hand: { kind: 'ranged', damage: 18, range: 14, cooldownSec: 1.6, accuracy: 0.75 } },
  },
  recipes: {},
  structCosts: {},
  creatures: { hatch: [{ role: 'role.hunter', weight: 1 }] },
};

const hall: ShipTemplate = {
  name: 'Hall',
  rows: [
    '##############################',
    '#____________________________#',
    '#____________________________#',
    '#____________________________#',
    '##############################',
  ],
};

/** A derelict hall at the origin (sector tiles = local tiles); optionally a second ship far off. */
function make(seed = 7): { sim: Sim; wreck: number } {
  const sim = new Sim(seed, content);
  const wreck = stampShip(sim, hall, { faction: 'neutral', x: 0, y: 0, state: 'wreck' });
  return { sim, wreck };
}
function person(sim: Sim, x: number, y: number, role = 'role.civ', weapon?: string): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role, species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...NONE });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction: 'player' });
  if (weapon) sim.world.add(id, EquipC, { weapon });
  return id;
}
function run(sim: Sim, ticks: number, stop: () => boolean = () => false): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
}
const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const sac = (sim: Sim, id: number) => sim.world.get(id, EggSacC)!;
const aliens = (sim: Sim) => sim.world.query(AlienC);
const HATCH = Math.round(SAC_STAGE_SEC * TICK_HZ) * 2 + 5;

describe('egg sacs', () => {
  it('stay dormant with nobody near, and hatch when a non-alien comes close with line of sight', () => {
    const { sim, wreck } = make();
    const s = laySac(sim, wreck, 20, 2, 1, false);
    const crew = person(sim, 3, 2);
    run(sim, 40);
    expect(sac(sim, s).state).toBe('dormant');
    sim.world.get(crew, PositionC)!.x = 18;
    sim.world.get(crew, PositionC)!.toX = 18;
    const ev = run(sim, 10);
    expect(of(ev, 'eggsac.disturbed')[0]?.cause).toBe('proximity');
    expect(sac(sim, s).state).toBe('hatching');
  });

  it('hatches when damaged, plays stages 0..2, lets an alien out on stage 2, then bursts', () => {
    const { sim, wreck } = make();
    const s = laySac(sim, wreck, 20, 2, 1, false);
    sac(sim, s).hp -= 5;
    const ev = run(sim, 1);
    expect(of(ev, 'eggsac.disturbed')[0]?.cause).toBe('damage');
    const stages: number[] = [];
    const all = run(sim, HATCH + 40, () => {
      if (stages.at(-1) !== sac(sim, s).stage) stages.push(sac(sim, s).stage);
      return false;
    });
    expect(stages).toEqual([0, 1, 2, 3]);
    const hatched = of(all, 'eggsac.hatched');
    expect(hatched).toHaveLength(1);
    expect(hatched[0]?.aliens).toHaveLength(1);
    const a = hatched[0]!.aliens[0]!;
    expect(sim.world.get(a, AllegianceC)?.faction).toBe('alien');
    expect(sim.world.get(a, AlienC)?.ship).toBe(wreck);
    expect(sac(sim, s).state).toBe('burst');
  });

  it('chain-hatches nearby dormant sacs after a short delay, but not far ones', () => {
    const { sim, wreck } = make();
    const a = laySac(sim, wreck, 10, 2, 1, false);
    const b = laySac(sim, wreck, 13, 3, 1, false);
    const far = laySac(sim, wreck, 27, 1, 1, false);
    sac(sim, a).hp -= 1;
    const ev = run(sim, 4 * TICK_HZ);
    expect(of(ev, 'eggsac.disturbed').map((e) => [e.sac, e.cause])).toEqual([[a, 'damage'], [b, 'chain']]);
    const delay = ev.findIndex((e) => e.type === 'eggsac.disturbed' && e.sac === b);
    expect(delay).toBeGreaterThan(0);
    expect(sac(sim, far).state).toBe('dormant');
  });

  it('can be destroyed before it hatches: no alien comes out', () => {
    const { sim, wreck } = make();
    const s = laySac(sim, wreck, 20, 2, 1, false);
    const crew = person(sim, 2, 2, 'role.sec', 'item.rifle');
    sim.enqueue({ type: 'crew.draft', id: crew, drafted: true });
    run(sim, 1);
    sim.enqueue({ type: 'crew.attack', id: crew, target: s });
    const ev = run(sim, 30 * TICK_HZ, () => sac(sim, s).state === 'burst');
    expect(of(ev, 'crew.hit').some((e) => e.target === s)).toBe(true);
    expect(sac(sim, s).destroyed).toBe(true);
    expect(aliens(sim)).toHaveLength(0);
  });

  it('drafted, armed crew shoot a sac they can already hit, without walking to one; undrafted or out of reach, nothing', () => {
    const { sim, wreck } = make();
    const near = laySac(sim, wreck, 9, 2, 1, false);
    const far = laySac(sim, wreck, 27, 2, 1, false);
    const idle = person(sim, 2, 3, 'role.civ', 'item.rifle');
    run(sim, 3 * TICK_HZ);
    expect(sac(sim, near).hp).toBe(sac(sim, near).max); // not drafted: no auto fire
    sim.enqueue({ type: 'crew.draft', id: idle, drafted: true });
    const ev = run(sim, 2 * TICK_HZ, () => sac(sim, near).hp < sac(sim, near).max);
    expect(of(ev, 'crew.attacked').some((e) => e.crew === idle && e.target === near)).toBe(true);
    expect(sim.world.get(idle, PositionC)).toMatchObject({ x: 2, y: 3 });
    expect(sac(sim, far).hp).toBe(sac(sim, far).max);
    // A sac out of reach (beyond rifle range): no shot and no walk.
    const b = make();
    laySac(b.sim, b.wreck, 27, 2, 1, false);
    const c = person(b.sim, 2, 3, 'role.civ', 'item.rifle');
    b.sim.enqueue({ type: 'crew.draft', id: c, drafted: true });
    const ev2 = run(b.sim, 3 * TICK_HZ);
    expect(of(ev2, 'crew.attacked')).toHaveLength(0);
    expect(b.sim.world.get(c, PositionC)).toMatchObject({ x: 2, y: 3 });
  });

  it('a nest lays new sacs while a non-alien is aboard, up to its cap', () => {
    const { sim, wreck } = make();
    sim.world.add(sim.world.createEntity(), NestC, { ship: wreck, x: 25, y: 2, timer: 0, laid: 0 });
    run(sim, 70 * TICK_HZ);
    expect(sim.world.query(EggSacC)).toHaveLength(0); // nobody aboard
    person(sim, 2, 2);
    run(sim, 300 * TICK_HZ);
    expect(sim.world.query(EggSacC).length).toBe(3);
  });
});

describe('aliens', () => {
  it('hunt the crew member they see and down them (downed and bleeding out as usual)', () => {
    const { sim, wreck } = make();
    const crew = person(sim, 4, 2);
    spawnAlien(sim, wreck, 'role.hunter', 12, 2);
    run(sim, 90 * TICK_HZ, () => sim.world.has(crew, DownedC));
    expect(sim.world.has(crew, DownedC)).toBe(true);
    expect(sim.world.get(crew, DownedC)!.bleed).toBeGreaterThan(0);
  });

  it('die to armed crew firing back (a corpse, no downed state)', () => {
    const { sim, wreck } = make(3);
    person(sim, 2, 2, 'role.sec', 'item.rifle');
    const a = spawnAlien(sim, wreck, 'role.hunter', 25, 2);
    const ev = run(sim, 90 * TICK_HZ, () => sim.world.has(a, DeadC));
    expect(sim.world.has(a, DeadC)).toBe(true);
    expect(sim.world.has(a, DownedC)).toBe(false);
    expect(of(ev, 'crew.hit').some((e) => e.target === a)).toBe(true);
  });

  it('a spitter shoots from range and backs off while it reloads', () => {
    const { sim, wreck } = make(4);
    const crew = person(sim, 5, 2);
    const a = spawnAlien(sim, wreck, 'role.spitter', 10, 2);
    const ev = run(sim, 20 * TICK_HZ);
    const shots = of(ev, 'crew.attacked').filter((e) => e.crew === a);
    expect(shots.length).toBeGreaterThan(0);
    expect(shots.every((e) => e.ranged && e.weapon === 'spit')).toBe(true);
    expect(shots.some((e) => Math.hypot(e.tx - e.x, e.ty - e.y) > 1.5)).toBe(true);
    expect(sim.world.has(crew, DeadC)).toBe(false);
  });

  it('stay on the ship they hatched on: idle ones roam near home, and crew on another ship are out of reach', () => {
    const { sim, wreck } = make();
    const mine = stampShip(sim, hall, { faction: 'player', x: 0, y: 40 });
    const crew = person(sim, 5, 42);
    const a = spawnAlien(sim, wreck, 'role.hunter', 15, 2);
    let away = 0;
    let far = 0;
    run(sim, 120 * TICK_HZ, () => {
      const p = sim.world.get(a, PositionC)!;
      if (shipIdOf(sim, p) !== wreck) away++;
      if (Math.hypot(p.x - 15, p.y - 2) > 4 * 1.5) far++;
      return false;
    });
    expect(shipIdOf(sim, sim.world.get(crew, PositionC)!)).toBe(mine);
    expect(away).toBe(0);
    expect(far).toBe(0);
    expect(sim.world.get(crew, HealthC)!.hp).toBe(CREW_MAX_HP);
  });

  it('is deterministic: the same seed and setup give the same world', () => {
    const once = () => {
      const { sim, wreck } = make(11);
      laySac(sim, wreck, 14, 2, 2);
      laySac(sim, wreck, 18, 1, 1);
      person(sim, 4, 2, 'role.sec', 'item.rifle');
      person(sim, 5, 3);
      sim.world.add(sim.world.createEntity(), NestC, { ship: wreck, x: 25, y: 2, timer: 0, laid: 0 });
      run(sim, 60 * TICK_HZ);
      return JSON.stringify(serialize(sim));
    };
    expect(once()).toBe(once());
  });
});
