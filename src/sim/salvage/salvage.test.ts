import { describe, expect, it } from 'vitest';
import { ShipC } from '../combat/components';
import { stampShip } from '../combat/ships';
import { wreckShip } from '../combat/wreck';
import { isPickupRegion } from '../ferry/pick';
import { spillItems } from '../items/stacks';
import { queueTransfer } from '../logistics/handlers';
import { FerryC } from '../ferry/components';
import { CrewC, DeadC, HealthC, JobC, NeedsC, PathC, PositionC, PrioritiesC, type Priorities } from '../crew/components';
import type { SimEvent } from '../events';
import { AllegianceC, SurrenderedC } from '../fight/components';
import { EggSacC, NestC } from '../aliens/components';
import { laySac } from '../aliens/spawn';
import { ItemStackC } from '../items/components';
import { ModuleC } from '../modules/components';
import type { ContentRegistry, ModuleDef, ScrapType, ShipTemplate } from '../registry';
import { shipIdOf } from '../regions';
import { Sim } from '../sim';
import { Struct, writeStruct } from '../structure';
import { CREW_MAX_HP } from '../tuning';
import { SalvageOrderC } from './components';

const mod = (o: Partial<ModuleDef>): ModuleDef => ({
  name: 'm', asset: 'm', footprint: [1, 1], solid: false, power: 0, flammability: 0.1, maxHp: 100, buildWork: 20, ...o,
});
const COST = [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }];
const content: ContentRegistry = {
  ships: {},
  roles: {},
  species: { 'species.human': { name: 'H', moveSpeed: 3, workSpeed: 2, restDecay: 0, airless: true } },
  modules: {
    console: mod({ scrap: 'tech', cost: COST }),
    reactor: mod({ scrap: 'energy', cost: COST }),
    gun: mod({ scrap: 'weapons', cost: COST }),
    bed: mod({ scrap: 'comfort', cost: COST }),
    bay: mod({ cost: COST }), // a robot module: no scrap type
  },
  crewNames: [],
  items: {
    'item.metal': { name: 'Metal', tags: [], stackSize: 100 },
    'item.electronics': { name: 'E', tags: [], stackSize: 100 },
    ...Object.fromEntries((['hull', 'tech', 'energy', 'weapons', 'comfort'] as const).map((t) => [`item.scrap_${t}`, { name: t, tags: ['scrap'], stackSize: 100 }])),
  },
  recipes: {},
  structCosts: { floor: [{ item: 'item.metal', count: 1 }], wall: [{ item: 'item.metal', count: 2 }], door: [{ item: 'item.metal', count: 2 }, { item: 'item.electronics', count: 1 }] },
};
const rows = ['##########', '#________#', '#___D____#', '#________#', '##########'];
const parts = [
  { def: 'console', x: 1, y: 1, rot: 0 }, { def: 'reactor', x: 3, y: 1, rot: 0 }, { def: 'gun', x: 5, y: 1, rot: 0 }, { def: 'bed', x: 7, y: 1, rot: 0 },
];
const RUIN = { cause: 'decay' as const, impacts: [], breaches: [], decals: [], hooks: [], modules: [] };
const all: ScrapType[] = ['hull', 'tech', 'energy', 'weapons', 'comfort'];
const prio = (v: number): Priorities => ({ firefighting: v, medical: v, operating: v, repair: v, construction: v, hauling: v, refining: v, crafting: v, research: v, cooking: v, patrol: v });

/** Air in the hall at (x0, y0), so crew work there without suits (the vacuum rules belong to the EVA slice). */
function breathable(sim: Sim, x0: number, y0: number): void {
  const g = sim.sector.grid;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[0]!.length; x++) if (g.get('struct', x0 + x, y0 + y) !== Struct.Space) { g.set('o2', x0 + x, y0 + y, 21); g.set('temp', x0 + x, y0 + y, 20); }
  }
}

function derelict(sim: Sim, t: Partial<ShipTemplate> = {}, ruin = true): number {
  const id = stampShip(sim, { name: 'Wreck', rows, modules: parts, ...t }, { faction: 'neutral', x: 0, y: 0, state: 'wreck' });
  if (ruin) sim.world.get(id, ShipC)!.ruin = { ...RUIN };
  breathable(sim, 0, 0);
  return id;
}
function person(sim: Sim, x: number, y: number, faction: 'player' | 'alien' = 'player'): number {
  const id = sim.world.createEntity();
  sim.world.add(id, CrewC, { name: 'T', role: 'r', species: 'species.human', appearanceSeed: 1, activity: 'idle' });
  sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
  sim.world.add(id, PathC, { steps: [] });
  sim.world.add(id, PrioritiesC, prio(3));
  sim.world.add(id, NeedsC, { rest: 100 });
  sim.world.add(id, HealthC, { hp: CREW_MAX_HP, max: CREW_MAX_HP });
  sim.world.add(id, AllegianceC, { faction });
  return id;
}

/** Run ticks, standing in for the haulers: loose stacks are carried off every tick into the tally. */
function run(sim: Sim, ticks: number, tally: Record<string, number> = {}, stop: () => boolean = () => false): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
    for (const id of [...sim.world.query(ItemStackC)]) {
      const s = sim.world.get(id, ItemStackC)!;
      tally[s.item] = (tally[s.item] ?? 0) + s.count;
      sim.sector.grid.set('item', s.x, s.y, 0);
      sim.world.destroyEntity(id);
    }
  }
  return out;
}
const order = (sim: Sim, ship: number, types: ScrapType[]): SimEvent[] => {
  sim.enqueue({ type: 'salvage.order', ship, types });
  sim.step();
  return sim.events.drain();
};
const rejected = (ev: SimEvent[]): string | undefined => ev.find((e): e is Extract<SimEvent, { type: 'command.rejected' }> => e.type === 'command.rejected')?.reason;
const mods = (sim: Sim, ship: number): number => sim.world.query(ModuleC).filter((m) => shipIdOf(sim, sim.world.get(m, ModuleC)) === ship).length;
const withoutRobot = { modules: parts };

describe('salvage orders', () => {
  it('are refused for a non-wreck, robot-only content and bad types', () => {
    const sim = new Sim(1, content);
    const live = stampShip(sim, { name: 'Prize', rows, modules: parts }, { faction: 'player', x: 0, y: 0, state: 'prize' });
    expect(rejected(order(sim, live, all))).toBe('notDerelict');
    const bare = stampShip(sim, { name: 'Bare', rows, modules: parts }, { faction: 'neutral', x: 30, y: 0, state: 'wreck' });
    expect(rejected(order(sim, bare, all))).toBeUndefined(); // no ruin data needed: any wreck
    const robots = stampShip(sim, { name: 'Bots', rows, modules: [{ def: 'bay', x: 1, y: 1, rot: 0 }] }, { faction: 'neutral', x: 60, y: 0, state: 'wreck' });
    sim.world.get(robots, ShipC)!.ruin = { ...RUIN };
    expect(rejected(order(sim, robots, all))).toBe('robotOnly');
    const ok = stampShip(sim, { name: 'Ok', rows, modules: parts }, { faction: 'neutral', x: 90, y: 0, state: 'wreck' });
    sim.world.get(ok, ShipC)!.ruin = { ...RUIN };
    expect(rejected(order(sim, ok, []))).toBe('badValue');
    expect(rejected(order(sim, ok, ['bogus' as ScrapType]))).toBe('badValue');
    expect(rejected(order(sim, ok, all))).toBeUndefined();
    expect(sim.world.get(ok, SalvageOrderC)?.types).toEqual(all);
  });

  it('strip only the ticked types, and leave the wreck standing', () => {
    const sim = new Sim(2, content);
    const w = derelict(sim);
    person(sim, 4, 3);
    order(sim, w, ['tech', 'weapons']);
    const tally: Record<string, number> = {};
    const ev = run(sim, 1200, tally, () => !sim.world.has(w, SalvageOrderC));
    expect(ev.some((e) => e.type === 'salvage.done' && !e.removed)).toBe(true);
    const left = sim.world.query(ModuleC).map((m) => sim.world.get(m, ModuleC)!.def).sort();
    expect(left).toEqual(['bed', 'reactor']);
    expect(Object.keys(tally).every((k) => k === 'item.scrap_tech' || k === 'item.scrap_weapons')).toBe(true);
    for (const n of Object.values(tally)) expect(n).toBeLessThan(10);
    expect(sim.world.has(w, ShipC)).toBe(true);
    expect(sim.sector.grid.get('struct', 0, 0)).toBe(Struct.Wall); // hull was not ticked
  });

  it('give scrap of the part type, always below the part cost, and nothing for a robot module', () => {
    const sim = new Sim(3, content);
    const w = derelict(sim, { modules: [...parts, { def: 'bay', x: 8, y: 3, rot: 0 }] });
    person(sim, 4, 3);
    person(sim, 6, 3);
    const tally: Record<string, number> = {};
    order(sim, w, all);
    run(sim, 3000, tally, () => !sim.world.has(w, SalvageOrderC));
    const cost = 10;
    for (const t of ['tech', 'energy', 'weapons', 'comfort']) expect(tally[`item.scrap_${t}`] ?? 0, t).toBeLessThan(cost);
    // The module scrap is the only source of its type: a single stripped part, so at most cost - 1.
    expect(Object.keys(tally).every((k) => k.startsWith('item.scrap_'))).toBe(true);
    expect(tally['item.scrap_hull']).toBeGreaterThan(0);
    expect(tally['item.metal']).toBeUndefined(); // no refund
    expect(mods(sim, w)).toBe(1); // the robot bay stays
    const bay = sim.world.query(ModuleC).find((m) => sim.world.get(m, ModuleC)!.def === 'bay');
    expect(bay).toBeDefined();
    expect(sim.world.has(w, ShipC)).toBe(true); // something is left
  });

  it('remove the wreck once nothing is left, clearing its tiles', () => {
    const sim = new Sim(4, content);
    const w = derelict(sim, withoutRobot);
    person(sim, 4, 3);
    person(sim, 5, 3);
    order(sim, w, all);
    // The last tiles are under the crew themselves; the EVA slice has suited crew work them from outside, so stand in for that here.
    const ev = run(sim, 6000, {}, () => {
      const left = [...Array(rows.length * rows[0]!.length).keys()].filter((i) => sim.sector.grid.get('struct', i % 10, Math.floor(i / 10)) !== Struct.Space);
      if (left.length <= 2 && sim.world.query(ModuleC).length === 0) for (const i of left) writeStruct(sim.sector.grid, i % 10, Math.floor(i / 10), Struct.Space);
      return !sim.world.has(w, ShipC);
    });
    expect(sim.world.has(w, ShipC)).toBe(false);
    expect(ev.some((e) => e.type === 'salvage.done' && e.removed)).toBe(true);
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[0]!.length; x++) {
        const s = sim.sector.grid;
        expect([s.get('struct', x, y), s.get('ship', x, y), s.get('module', x, y), s.get('item', x, y)]).toEqual([Struct.Space, 0, 0, 0]);
      }
    }
    expect(sim.world.query(ModuleC).length).toBe(0);
    expect(sim.world.query(JobC).length).toBe(0);
  });

  it('strip modules first, then walls and doors, then floors', () => {
    const sim = new Sim(5, content);
    const w = derelict(sim);
    person(sim, 4, 3);
    order(sim, w, all);
    const phase: string[] = [];
    run(sim, 6000, {}, () => {
      const g = sim.sector.grid;
      const m = mods(sim, w), wall = rows.join('').split('').filter((_, i) => g.get('struct', i % 10, Math.floor(i / 10)) === Struct.Wall || g.get('struct', i % 10, Math.floor(i / 10)) === Struct.Door).length;
      const floor = [...Array(50).keys()].filter((i) => g.get('struct', i % 10, Math.floor(i / 10)) === Struct.Floor).length;
      const tag = m ? 'm' : wall ? 'w' : floor ? 'f' : 'x';
      if (phase.at(-1) !== tag) phase.push(tag);
      return !sim.world.has(w, SalvageOrderC);
    });
    expect(phase.join('')).toMatch(/^mwf/);
    expect(phase.join('')).not.toMatch(/fw|wm|fm/);
  });

  it('are the same for the same seed', () => {
    const go = (): string => {
      const sim = new Sim(9, content);
      const w = derelict(sim);
      person(sim, 4, 3);
      person(sim, 6, 3);
      const tally: Record<string, number> = {};
      order(sim, w, all);
      run(sim, 3000, tally, () => !sim.world.has(w, SalvageOrderC));
      return JSON.stringify([sim.tick, tally]);
    };
    expect(go()).toBe(go());
  });

  it('can be cancelled, which drops the open jobs', () => {
    const sim = new Sim(6, content);
    const w = derelict(sim);
    order(sim, w, all);
    run(sim, 30);
    expect(sim.world.query(JobC).length).toBeGreaterThan(0);
    sim.enqueue({ type: 'salvage.cancel', ship: w });
    sim.step();
    expect(sim.world.has(w, SalvageOrderC)).toBe(false);
    expect(sim.world.query(JobC).length).toBe(0);
  });
});

describe('wrecks of a fight', () => {
  it('can be salvaged: wreckShip leaves no ruin data, and the order still strips it', () => {
    const sim = new Sim(11, content);
    const w = stampShip(sim, { name: 'Shot up', rows, modules: parts }, { faction: 'hostile', x: 0, y: 0, state: 'active' });
    breathable(sim, 0, 0);
    wreckShip(sim, w);
    expect(sim.world.get(w, ShipC)!.ruin).toBeUndefined();
    person(sim, 4, 3);
    sim.events.drain();
    expect(rejected(order(sim, w, ['tech']))).toBeUndefined();
    run(sim, 1200, {}, () => !sim.world.has(w, SalvageOrderC));
    expect(sim.world.query(ModuleC).map((m) => sim.world.get(m, ModuleC)!.def).sort()).toEqual(['bed', 'gun', 'reactor']);
  });
});

describe('scrap on a combat wreck', () => {
  it('is a valid pickup and transfer source (no ruin data needed)', () => {
    const sim = new Sim(13, content);
    const w = stampShip(sim, { name: 'Shot up', rows, modules: parts }, { faction: 'hostile', x: 0, y: 0, state: 'active' });
    wreckShip(sim, w);
    const home = stampShip(sim, { name: 'Home', rows, modules: parts }, { faction: 'player', x: 30, y: 0, state: 'active' });
    spillItems(sim, w, 2, 2, 'item.scrap_hull', 5);
    expect(isPickupRegion(sim, w)).toBe(true);
    expect(typeof queueTransfer(sim, w, home, [{ item: 'item.scrap_hull', count: 5 }])).toBe('number');
  });
});

describe('wreck removal waits for shuttle runs', () => {
  it('holds while a hand-made ferry run has the wreck as its source', () => {
    const sim = new Sim(12, content);
    const w = derelict(sim, { modules: [{ def: 'console', x: 1, y: 1, rot: 0 }] });
    sim.world.get(w, ShipC)!.ruin = { ...RUIN };
    const shuttle = sim.world.createEntity();
    sim.world.add(shuttle, FerryC, { from: w, to: 99, items: [], crew: [], phase: 'gather', timer: 0 });
    person(sim, 4, 3);
    person(sim, 5, 3);
    order(sim, w, all);
    run(sim, 6000, {}, () => {
      const left = [...Array(rows.length * rows[0]!.length).keys()].filter((i) => sim.sector.grid.get('struct', i % 10, Math.floor(i / 10)) !== Struct.Space);
      if (left.length <= 2 && sim.world.query(ModuleC).length === 0) for (const i of left) writeStruct(sim.sector.grid, i % 10, Math.floor(i / 10), Struct.Space);
      return left.length === 0;
    });
    run(sim, 100);
    expect(sim.world.has(w, ShipC)).toBe(true); // stripped, but the run is still on
    sim.world.remove(shuttle, FerryC);
    run(sim, 40);
    expect(sim.world.has(w, ShipC)).toBe(false);
  });
});

describe('hostiles block an order', () => {
  const blocked = (sim: Sim, w: number): boolean => sim.world.get(w, SalvageOrderC)?.status === 'blocked';
  it('a living hostile, an egg sac or a nest blocks it with no jobs open, and it runs again once cleared', () => {
    const sim = new Sim(7, content);
    const w = derelict(sim);
    const alien = person(sim, 8, 3, 'alien');
    sim.world.remove(alien, PrioritiesC);
    const sac = laySac(sim, w, 2, 3, 1, false);
    const nest = sim.world.createEntity();
    sim.world.add(nest, NestC, { ship: w, x: 5, y: 3, timer: 0, laid: 0 });
    const events = [...order(sim, w, all), ...run(sim, 40)];
    expect(blocked(sim, w)).toBe(true);
    expect(events.filter((e) => e.type === 'salvage.blocked').length).toBe(1);
    expect(sim.world.query(JobC).length).toBe(0);
    // A surrendered hostile no longer blocks; the sac and the nest still do.
    sim.world.add(alien, SurrenderedC, { tick: sim.tick });
    run(sim, 20);
    expect(blocked(sim, w)).toBe(true);
    sim.world.destroyEntity(sac);
    run(sim, 20);
    expect(blocked(sim, w)).toBe(true);
    sim.world.destroyEntity(nest);
    run(sim, 20);
    expect(blocked(sim, w)).toBe(false);
    expect(sim.world.query(JobC).length).toBeGreaterThan(0);
    // A dead hostile does not block either, a living one does again.
    const another = person(sim, 8, 2, 'alien');
    run(sim, 20);
    expect(blocked(sim, w)).toBe(true);
    sim.world.add(another, DeadC, { tick: sim.tick } as never);
    run(sim, 20);
    expect(blocked(sim, w)).toBe(false);
    expect(sim.world.has(sac, EggSacC)).toBe(false);
  });
});

describe('build tools on a wreck', () => {
  it('are rejected; forcing a door still works', () => {
    const sim = new Sim(8, content);
    const w = derelict(sim);
    const rej = (c: Parameters<Sim['enqueue']>[0]): string | undefined => {
      sim.enqueue(c);
      sim.step();
      return rejected(sim.events.drain());
    };
    expect(rej({ type: 'job.build', ship: w, x: 2, y: 2, struct: Struct.Wall })).toBe('wreck');
    expect(rej({ type: 'job.deconstruct', ship: w, x: 0, y: 0 })).toBe('wreck');
    expect(rej({ type: 'job.buildModule', ship: w, x: 2, y: 3, def: 'bed', rot: 0 })).toBe('wreck');
    expect(rej({ type: 'job.deconstructModule', ship: w, x: 1, y: 1 })).toBe('wreck');
    expect(rej({ type: 'job.forceDoor', ship: w, x: 4, y: 2 })).toBe('notJammed');
    expect(sim.world.query(JobC).length).toBe(0);
  });
});
