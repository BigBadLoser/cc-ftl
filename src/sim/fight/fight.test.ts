import { describe, expect, it } from 'vitest';
import {
  CrewC, DeadC, DownedC, HealthC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities,
} from '../crew/components';
import type { SimEvent } from '../events';
import { shipOf, spawnShip } from '../combat/ships';
import { storageCount } from '../items/storage';
import type { ContentRegistry, ModuleDef, ShipTemplate } from '../registry';
import { deserialize, serialize } from '../save';
import { Sim } from '../sim';
import { CREW_MAX_HP, SURRENDER_HP_FRAC } from '../tuning';
import { AllegianceC, EquipC, FighterC, SurrenderedC } from './components';
import { sightLine } from './los';
import { isSubdued } from './relations';
import { hitChance, wielded } from './weapons';
import { StorageC } from '../items/components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const content: ContentRegistry = {
  ships: {},
  roles: {
    'role.sec': { name: 'Sec', priorities: {} as Priorities, skills: { gunnery: 1, melee: 1 }, fighter: true, loadout: ['item.rifle', 'item.sidearm'] },
    'role.civ': { name: 'Civ', priorities: {} as Priorities },
    'role.medic': { name: 'Medic', priorities: {} as Priorities },
    'role.brave': { name: 'Brave', priorities: {} as Priorities, surrenderBelow: 0 },
  },
  species: { 'species.human': { name: 'H', moveSpeed: 2.5, workSpeed: 1, restDecay: 0.6 } },
  modules: {
    crate: mod({ solid: true }),
    fullcover: mod({ solid: true, cover: 'full' }),
    locker: mod({ solid: true, storage: { capacity: 4 } }),
    bed: mod({ footprint: [1, 2], bed: true }),
    console: mod({ solid: true, access: [0, 1], console: 'helm' }),
  },
  crewNames: [],
  items: {
    'item.sidearm': { name: 'S', tags: [], stackSize: 5, hand: { kind: 'ranged', damage: 12, range: 8, cooldownSec: 1, accuracy: 0.7 } },
    'item.rifle': { name: 'R', tags: [], stackSize: 5, hand: { kind: 'ranged', damage: 18, range: 14, cooldownSec: 1.6, accuracy: 0.75 } },
    'item.blade': { name: 'B', tags: [], stackSize: 5, hand: { kind: 'melee', damage: 20, range: 1, cooldownSec: 1.2, accuracy: 0.8 } },
  },
  recipes: {},
  structCosts: {},
};

const hall = (extra: Partial<ShipTemplate> = {}): ShipTemplate => ({
  name: 'Hall',
  rows: [
    '########################',
    '#______________________#',
    '#______________________#',
    '#______________________#',
    '########################',
  ],
  ...extra,
});
const split = (extra: Partial<ShipTemplate> = {}): ShipTemplate => ({
  name: 'Split',
  rows: [
    '########################',
    '#_________#____________#',
    '#_________D____________#',
    '#_________#____________#',
    '########################',
  ],
  ...extra,
});
const flat = (v: number): Priorities => ({
  firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, crafting: v, cooking: v,
});

function make(template: ShipTemplate = hall(), seed = 5): Sim {
  const sim = new Sim(seed, content);
  spawnShip(sim, template, { gridId: 1, faction: 'player', x: 0, y: 0 }); // at the origin: local tiles are sector tiles
  return sim;
}
function person(
  sim: Sim, x: number, y: number, faction: 'player' | 'hostile', role = 'role.civ', weapon?: string, prio: Priorities = flat(0),
): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role, species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { gridId: 1, x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, { ...prio });
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction });
  if (weapon) sim.world.add(id, EquipC, { weapon });
  return id;
}
function run(sim: Sim, limit: number, stop: () => boolean = () => false): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < limit && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
}
const of = <T extends SimEvent['type']>(events: SimEvent[], type: T): Extract<SimEvent, { type: T }>[] =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const hp = (sim: Sim, id: number): number => sim.world.get(id, HealthC)!.hp;
const grid = (sim: Sim) => sim.grids.get(1)!;

describe('line of sight and cover', () => {
  it('is blocked by walls, closed doors and solid modules, and passes open doors', () => {
    const sim = make(split());
    const g = grid(sim);
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 8, y: 2 }).visible).toBe(true);
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 15, y: 2 }).visible).toBe(false); // closed door at (10, 2)
    expect(sightLine(sim, g, { x: 2, y: 1 }, { x: 15, y: 1 }).visible).toBe(false); // wall segment
    g.set('door', 10, 2, 255);
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 15, y: 2 }).visible).toBe(true);
    // A solid module in between blocks (here, a crate on a fresh ship).
    const open = make(hall({ modules: [{ def: 'crate', x: 5, y: 2, rot: 0 }] }));
    expect(sightLine(open, grid(open), { x: 2, y: 2 }, { x: 9, y: 2 }).visible).toBe(false);
    expect(sightLine(open, grid(open), { x: 2, y: 1 }, { x: 9, y: 1 }).visible).toBe(true);
  });

  it('gives cover from the module beside the target, from a doorway and from a flanking wall', () => {
    const sim = make(hall({ modules: [{ def: 'crate', x: 5, y: 2, rot: 0 }, { def: 'fullcover', x: 15, y: 2, rot: 0 }] }));
    const g = grid(sim);
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 6, y: 2 })).toEqual({ visible: true, cover: 'partial' });
    expect(sightLine(sim, g, { x: 11, y: 2 }, { x: 16, y: 2 })).toEqual({ visible: true, cover: 'full' });
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 5, y: 3 }).cover).toBe('none'); // beside the crate, not behind it
    expect(sightLine(sim, g, { x: 2, y: 2 }, { x: 6, y: 1 }).cover).toBe('none');
    const door = make(split());
    door.enqueue({ type: 'debug.setField', gridId: 1, x: 10, y: 2, field: 'door', value: 255 });
    run(door, 1);
    expect(sightLine(door, grid(door), { x: 4, y: 2 }, { x: 11, y: 2 }).cover).toBe('partial'); // doorway in front of the target
  });

  it('cover lowers the hit chance, distance lowers it, skill raises it', () => {
    const sim = make();
    const sec = person(sim, 2, 2, 'player', 'role.sec', 'item.sidearm');
    const civ = person(sim, 3, 3, 'player', 'role.civ', 'item.sidearm');
    const w = wielded(sim, sec).def;
    const none = hitChance(sim, sec, w, 5, 'none');
    expect(hitChance(sim, sec, w, 5, 'partial')).toBeLessThan(none);
    expect(hitChance(sim, sec, w, 5, 'full')).toBeLessThan(hitChance(sim, sec, w, 5, 'partial'));
    expect(hitChance(sim, sec, w, 8, 'none')).toBeLessThan(hitChance(sim, sec, w, 2, 'none'));
    expect(hitChance(sim, sec, w, 5, 'none')).toBeGreaterThan(hitChance(sim, civ, w, 5, 'none'));
  });

  it('shows up in the shot results: shooters behind cover get hit less often', () => {
    const rate = (modules: ShipTemplate['modules']): number => {
      let hits = 0;
      let shots = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const sim = make(hall({ modules }), seed);
        const shooter = person(sim, 2, 2, 'hostile', 'role.civ', 'item.sidearm');
        const tgt = person(sim, 6, 2, 'player', 'role.civ'); // drafted, holding fire, standing still
        sim.enqueue({ type: 'crew.draft', id: tgt, drafted: true });
        sim.enqueue({ type: 'crew.setEngage', id: tgt, engage: false });
        sim.world.get(shooter, HealthC)!.hp = 1e9;
        sim.world.get(tgt, HealthC)!.hp = 1e9; // never goes down: count shots
        sim.world.get(tgt, HealthC)!.max = 1e9;
        const ev = run(sim, 20 * 30);
        hits += of(ev, 'crew.hit').filter((e) => e.crew === shooter).length;
        shots += of(ev, 'crew.attacked').filter((e) => e.crew === shooter).length;
      }
      return hits / shots;
    };
    expect(rate([{ def: 'crate', x: 5, y: 2, rot: 0 }])).toBeLessThan(rate([]) - 0.1);
  });
});

describe('crew combat', () => {
  it('lets drafted crew attack the target the player orders, walking into range first', () => {
    const sim = make();
    const gunner = person(sim, 2, 2, 'player', 'role.civ', 'item.sidearm');
    const near = person(sim, 6, 1, 'hostile');
    const far = person(sim, 20, 3, 'hostile');
    sim.enqueue({ type: 'crew.draft', id: gunner, drafted: true });
    sim.enqueue({ type: 'crew.setEngage', id: gunner, engage: false });
    run(sim, 100);
    expect(hp(sim, near) + hp(sim, far)).toBe(2 * CREW_MAX_HP); // engage off: no shots at the nearest foe on its own
    sim.enqueue({ type: 'crew.attack', id: gunner, target: far });
    const ev = run(sim, 20 * 20);
    expect(of(ev, 'crew.attacked').every((e) => e.crew !== gunner || e.target === far)).toBe(true);
    expect(of(ev, 'crew.attacked').some((e) => e.crew === gunner)).toBe(true);
    const shot = of(ev, 'crew.attacked').find((e) => e.crew === gunner)!;
    expect(Math.hypot(shot.tx - shot.x, shot.ty - shot.y)).toBeLessThanOrEqual(8); // closed to sidearm range first
    expect(hp(sim, near)).toBe(CREW_MAX_HP);
    expect(hp(sim, far)).toBeLessThan(CREW_MAX_HP);
  });

  it('engages the nearest visible hostile when set to engage, and rejects bad orders', () => {
    const sim = make();
    const gunner = person(sim, 2, 2, 'player', 'role.civ', 'item.sidearm');
    const ally = person(sim, 3, 3, 'player');
    const foe = person(sim, 7, 2, 'hostile');
    sim.enqueue({ type: 'crew.attack', id: gunner, target: foe });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'notDrafted' });
    sim.enqueue({ type: 'crew.draft', id: gunner, drafted: true });
    sim.enqueue({ type: 'crew.attack', id: gunner, target: ally });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'badTarget' });
    run(sim, 20 * 10);
    expect(hp(sim, foe)).toBeLessThan(CREW_MAX_HP);
    expect(hp(sim, ally)).toBe(CREW_MAX_HP);
  });

  it('an armed defender beats an unarmed boarder', () => {
    const wins = [1, 2, 3, 4, 5, 6].map((seed) => {
      const sim = make(hall(), seed);
      const defender = person(sim, 3, 2, 'player', 'role.sec', 'item.sidearm');
      const boarder = person(sim, 20, 2, 'hostile');
      run(sim, 20 * 60, () => sim.world.has(boarder, DownedC) || sim.world.has(defender, DownedC));
      return sim.world.has(boarder, DownedC) && !sim.world.has(defender, DownedC);
    });
    expect(wins.every(Boolean)).toBe(true);
  });

  it('melee needs adjacency', () => {
    const sim = make();
    const fighter = person(sim, 2, 2, 'player', 'role.sec', 'item.blade');
    const foe = person(sim, 9, 2, 'hostile', 'role.civ', 'item.blade');
    sim.world.get(foe, HealthC)!.hp = 1e9;
    sim.world.get(fighter, HealthC)!.hp = 1e9;
    const ev = run(sim, 20 * 15);
    const swings = of(ev, 'crew.attacked');
    expect(swings.length).toBeGreaterThan(0);
    for (const s of swings) {
      expect(s.ranged).toBe(false);
      expect(Math.max(Math.abs(s.tx - s.x), Math.abs(s.ty - s.y))).toBeLessThanOrEqual(1);
    }
    expect(sim.world.has(fighter, DownedC)).toBe(false);
  });

  it('downs crew at 0 hp and the downed can still be rescued', () => {
    const sim = make(hall({ modules: [{ def: 'bed', x: 20, y: 2, rot: 0 }] }));
    person(sim, 3, 2, 'player', 'role.sec', 'item.rifle');
    const boarder = person(sim, 14, 1, 'hostile', 'role.brave');
    const medic = person(sim, 21, 3, 'player', 'role.medic', undefined, { ...flat(4), medical: 1 });
    sim.world.get(boarder, HealthC)!.hp = 20;
    const ev = run(sim, 20 * 60, () => sim.world.get(boarder, DownedC)?.stabilized === true);
    expect(of(ev, 'crew.downed').map((e) => e.crew)).toContain(boarder);
    expect(of(ev, 'crew.rescued').map((e) => e.crew)).toContain(boarder);
    expect(of(ev, 'crew.rescued')[0]!.by).toBe(medic);
    expect(sim.world.has(boarder, DeadC)).toBe(false);
  });

  it('unarmed civilians flee from hostiles instead of fighting', () => {
    const sim = make();
    const civ = person(sim, 8, 2, 'player', 'role.civ');
    const raider = person(sim, 5, 2, 'hostile', 'role.civ', 'item.blade');
    sim.world.get(raider, HealthC)!.hp = 1e9;
    const d0 = Math.abs(8 - 5);
    const ev = run(sim, 20 * 6);
    expect(of(ev, 'crew.attacked').some((e) => e.crew === civ)).toBe(false);
    expect(sim.world.get(civ, FighterC)?.mode).toBe('flee');
    const p = sim.world.get(civ, PositionC)!;
    expect(Math.hypot(p.x - sim.world.get(raider, PositionC)!.x, p.y - sim.world.get(raider, PositionC)!.y)).toBeGreaterThan(d0);
  });

  it('boarders hunt the defenders, then walk to a bridge console when nobody is left', () => {
    const sim = make(hall({ modules: [{ def: 'console', x: 20, y: 2, rot: 0 }] }));
    const boarder = person(sim, 2, 1, 'hostile', 'role.civ', 'item.sidearm');
    run(sim, 20 * 20);
    expect(sim.world.get(boarder, FighterC)?.mode ?? 'idle').toBe('idle');
    const p = sim.world.get(boarder, PositionC)!;
    expect([p.x, p.y]).toEqual([20, 3]); // the console's access tile
    // Defenders arrive; the boarder turns on them and takes no more chores.
    const defender = person(sim, 4, 3, 'player', 'role.sec', 'item.rifle');
    expect(shipOf(sim, 1)?.faction).toBe('player');
    const ev = run(sim, 20 * 10);
    expect(of(ev, 'crew.attacked').some((e) => e.crew === boarder && e.target === defender)).toBe(true);
  });
});

describe('equipping', () => {
  const stocked = (): Sim => make(hall({ modules: [{ def: 'locker', x: 12, y: 1, rot: 0, stock: [{ item: 'item.rifle', count: 1 }, { item: 'item.sidearm', count: 1 }] }] }));

  it('crew.equip fetches the weapon from storage; crew.unequip drops it', () => {
    const sim = stocked();
    const locker = sim.world.query(StorageC)[0] as number;
    const c = person(sim, 3, 3, 'player');
    sim.enqueue({ type: 'crew.equip', id: c, item: 'item.rifle' });
    const ev = run(sim, 20 * 10);
    expect(of(ev, 'crew.equipped')).toEqual([{ type: 'crew.equipped', crew: c, item: 'item.rifle' }]);
    expect(sim.world.get(c, EquipC)?.weapon).toBe('item.rifle');
    expect(storageCount(sim, locker, 'item.rifle')).toBe(0);
    sim.enqueue({ type: 'crew.equip', id: c, item: 'item.sidearm' }); // swaps: the rifle goes back
    run(sim, 20 * 10);
    expect(sim.world.get(c, EquipC)?.weapon).toBe('item.sidearm');
    expect(storageCount(sim, locker, 'item.rifle')).toBe(1);
    sim.enqueue({ type: 'crew.unequip', id: c });
    expect(of(run(sim, 1), 'crew.unequipped')).toHaveLength(1);
    expect(sim.world.get(c, EquipC)?.weapon).toBeNull();
    sim.enqueue({ type: 'crew.equip', id: c, item: 'item.blade' });
    expect(of(run(sim, 1), 'command.rejected')[0]).toMatchObject({ reason: 'noStock' });
  });

  it('security crew arm themselves from their role loadout', () => {
    const sim = stocked();
    const sec = person(sim, 3, 3, 'player', 'role.sec');
    run(sim, 20 * 15);
    expect(sim.world.get(sec, EquipC)?.weapon).toBe('item.rifle');
  });
});

describe('surrender', () => {
  it('badly hurt crew who are outnumbered lay down arms and stop fighting', () => {
    const sim = make();
    person(sim, 3, 2, 'player', 'role.sec', 'item.sidearm');
    person(sim, 3, 3, 'player', 'role.sec', 'item.sidearm');
    const beaten = person(sim, 12, 2, 'hostile', 'role.civ', 'item.sidearm');
    sim.world.get(beaten, HealthC)!.hp = CREW_MAX_HP * SURRENDER_HP_FRAC - 1;
    const ev = run(sim, 40);
    expect(of(ev, 'crew.surrendered').map((e) => e.crew)).toEqual([beaten]);
    expect(sim.world.has(beaten, SurrenderedC)).toBe(true);
    expect(isSubdued(sim, beaten)).toBe(true);
    expect(sim.world.get(beaten, EquipC)?.weapon).toBeNull();
    const later = run(sim, 20 * 5);
    expect(of(later, 'crew.attacked').some((e) => e.crew === beaten)).toBe(false);
    // Nobody keeps shooting a prisoner.
    expect(of(later, 'crew.attacked').some((e) => e.target === beaten)).toBe(false);
  });

  it('does not surrender when healthy, when not outnumbered or when the role never yields', () => {
    const sim = make();
    person(sim, 3, 2, 'player', 'role.sec', 'item.sidearm');
    const healthy = person(sim, 12, 2, 'hostile', 'role.civ', 'item.sidearm');
    const hurtDuel = person(sim, 12, 3, 'hostile', 'role.civ', 'item.sidearm');
    sim.world.get(hurtDuel, HealthC)!.hp = 25; // one defender against two raiders: not outnumbered
    run(sim, 20);
    expect(sim.world.has(healthy, SurrenderedC)).toBe(false);
    expect(sim.world.has(hurtDuel, SurrenderedC)).toBe(false);
    person(sim, 3, 3, 'player', 'role.sec', 'item.sidearm'); // now two against two... and a third makes it three
    person(sim, 4, 3, 'player', 'role.sec', 'item.sidearm');
    const stoic = person(sim, 13, 3, 'hostile', 'role.brave', 'item.sidearm');
    sim.world.get(stoic, HealthC)!.hp = 5;
    run(sim, 20);
    person(sim, 5, 3, 'player', 'role.sec', 'item.sidearm');
    run(sim, 20);
    expect(sim.world.has(hurtDuel, SurrenderedC)).toBe(true); // four defenders against three raiders
    expect(sim.world.has(stoic, SurrenderedC)).toBe(false);
  });
});

describe('determinism and saves', () => {
  const scenario = (): Sim => {
    const sim = make(hall({ modules: [{ def: 'crate', x: 9, y: 2, rot: 0 }] }), 9);
    person(sim, 3, 2, 'player', 'role.sec', 'item.rifle');
    person(sim, 3, 3, 'player', 'role.civ', 'item.sidearm');
    person(sim, 18, 2, 'hostile', 'role.civ', 'item.sidearm');
    person(sim, 18, 1, 'hostile', 'role.civ', 'item.blade');
    return sim;
  };

  it('runs identically twice, and a mid-fight save/load continues identically', () => {
    const a = scenario();
    const b = scenario();
    run(a, 300);
    run(b, 150);
    const reloaded = deserialize(serialize(b), content);
    run(b, 150);
    run(reloaded, 150);
    expect(serialize(b)).toBe(serialize(a));
    expect(serialize(reloaded)).toBe(serialize(a));
    expect(of(run(scenario(), 300), 'crew.attacked').length).toBeGreaterThan(0);
  });
});
