import { describe, expect, it } from 'vitest';
import { AboardC, AllegianceC, CrewC, DeadC, DownedC, DraftedC, EmbarkOrderC, EquipC, FighterC, HealthC, ModuleC, PathC, PositionC, PrioritiesC, ShipC, Struct, SurrenderedC, VehicleC, type ModuleDef, WeaponC, newGame, shipGrid, spawnCrew, type Sim, type SimEvent } from '../../sim';
import { content } from '../index';
import { shipIdOf, shipIds } from '../../sim/regions';
import { operatorOf } from '../../sim/combat/operators';
import { tileKey } from '../../sim/crew/spread';

/** The ship with ordinal `n` (1 = the player's, 2 = the first enemy). */
const nth = (sim: Sim, n: number): number => shipIds(sim)[n - 1] as number;
const run = (sim: Sim, n: number, stop: () => boolean = () => false): SimEvent[] => {
  const out: SimEvent[] = [];
  for (let i = 0; i < n && !stop(); i++) {
    sim.step();
    out.push(...sim.events.drain());
  }
  return out;
};
const crewOn = (sim: Sim, n: number): number[] => sim.world.query(CrewC).filter((i) => shipIdOf(sim, sim.world.get(i, PositionC)) === nth(sim, n));
const airlockOf = (sim: Sim, n: number): number =>
  sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)) === nth(sim, n) && sim.world.get(i, ModuleC)!.def === 'module.airlock')!;
const foesOn = (sim: Sim, n: number): number[] => crewOn(sim, n).filter((c) => sim.world.get(c, AllegianceC)?.faction !== 'player' && !sim.world.has(c, DeadC));
const rejected = (events: SimEvent[]): string[] => events.flatMap((e) => (e.type === 'command.rejected' ? [e.reason] : []));
const tileOf = (sim: Sim, id: number): { x: number; y: number } => {
  const p = sim.world.get(id, PositionC)!;
  return { x: p.toX, y: p.toY };
};
const draft = (sim: Sim, ids: number[]): void => {
  for (const id of ids) sim.enqueue({ type: 'crew.draft', id, drafted: true });
  run(sim, 1);
};

/** A raider next to the player with its weapons off, so only the crew fight. */
function setup(seed: number): Sim {
  const sim = newGame(seed, content);
  sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 100, y: 50 });
  run(sim, 5);
  for (const i of sim.world.query(WeaponC)) if (shipIdOf(sim, sim.world.get(i, ModuleC)!) === nth(sim, 2)) sim.world.get(i, ModuleC)!.enabled = false;
  return sim;
}
const SEEDS = [1, 2, 3];

/** Player shuttle with `n` crew aboard, docked at the raider's airlock; the passengers step out onto the raider. Returns them and the shuttle. */
function dockAndLand(sim: Sim, n: number): { shuttle: number; crew: number[] } {
  const shuttle = sim.world.query(VehicleC).find((i) => sim.world.get(i, VehicleC)!.homeShip === nth(sim, 1))!;
  const crew = crewOn(sim, 1).slice(0, n);
  for (const c of crew) sim.enqueue({ type: 'vehicle.embark', crew: c, vehicle: shuttle });
  run(sim, 800, () => crew.every((c) => sim.world.has(c, AboardC)));
  sim.enqueue({ type: 'vehicle.dock', vehicle: shuttle, airlock: airlockOf(sim, 2) });
  run(sim, 2000, () => sim.world.get(shuttle, VehicleC)!.state === 'docked');
  sim.enqueue({ type: 'vehicle.disembark', vehicle: shuttle });
  run(sim, 5);
  return { shuttle, crew: crew.filter((c) => !sim.world.has(c, AboardC)) };
}

describe('group move', () => {
  it.each(SEEDS)('spreads a drafted group over distinct free tiles around the click (seed %i)', (seed) => {
    const sim = newGame(seed, content);
    run(sim, 5);
    const crew = crewOn(sim, 1).slice(0, 4);
    expect(crew.length).toBe(4);
    draft(sim, crew);
    const goal = tileOf(sim, crew[0]!);
    sim.enqueue({ type: 'crew.moveGroup', ids: crew, x: goal.x, y: goal.y });
    run(sim, 1);
    run(sim, 20 * 40, () => crew.every((c) => !sim.world.get(c, DraftedC)!.target && !sim.world.get(c, PathC)!.steps.length));
    const grid = shipGrid(sim, nth(sim, 1))!;
    const tiles = crew.map((c) => tileOf(sim, c));
    expect(new Set(tiles.map((t) => tileKey(t.x, t.y))).size).toBe(4);
    for (const t of tiles) {
      expect(grid.get('struct', t.x, t.y)).not.toBe(Struct.Door);
      expect(Math.abs(t.x - goal.x) + Math.abs(t.y - goal.y)).toBeLessThanOrEqual(4);
    }
  });

  it('leaves out crew that are not drafted or are on another ship, and rejects a group with nobody to send', () => {
    const sim = setup(1);
    const [a, b] = crewOn(sim, 1);
    draft(sim, [a!]);
    const goal = tileOf(sim, b!);
    sim.enqueue({ type: 'crew.moveGroup', ids: [a!, b!], x: goal.x, y: goal.y });
    run(sim, 1);
    expect(sim.world.get(a!, DraftedC)!.target).not.toBeNull();
    expect(sim.world.has(b!, DraftedC)).toBe(false);
    const foe = foesOn(sim, 2)[0]!;
    sim.world.add(foe, DraftedC, { target: null });
    sim.enqueue({ type: 'crew.moveGroup', ids: [foe], x: goal.x, y: goal.y, ship: nth(sim, 1) });
    sim.enqueue({ type: 'crew.moveGroup', ids: [b!], x: goal.x, y: goal.y });
    expect(rejected(run(sim, 1))).toEqual(['otherShip', 'notDrafted']);
  });

  it('refuses a walk order onto another ship instead of accepting it and letting it lapse', () => {
    const sim = setup(1);
    const [a] = crewOn(sim, 1);
    draft(sim, [a!]);
    const there = tileOf(sim, foesOn(sim, 2)[0]!);
    sim.enqueue({ type: 'crew.moveTo', id: a!, x: there.x, y: there.y, ship: nth(sim, 2) });
    expect(rejected(run(sim, 1))).toEqual(['otherShip']);
    expect(sim.world.get(a!, DraftedC)!.target).toBeNull();
  });
});

describe('attack order', () => {
  it.each(SEEDS)('a drafted crew member walks to the ordered boarder and downs it (seed %i)', (seed) => {
    const sim = setup(seed);
    const { crew } = dockAndLand(sim, 3);
    expect(crew.length).toBeGreaterThan(0);
    for (const c of crew) sim.world.add(c, EquipC, { weapon: 'item.rifle' });
    draft(sim, crew);
    const foes = foesOn(sim, 2);
    for (const f of foes) sim.world.get(f, HealthC)!.hp = 8;
    const target = foes[0]!;
    sim.enqueue({ type: 'crew.attack', id: crew[0]!, target });
    run(sim, 1);
    expect(sim.world.get(crew[0]!, FighterC)!.ordered).toBe(target);
    run(sim, 20 * 90, () => sim.world.has(target, DownedC) || sim.world.has(target, DeadC) || sim.world.has(target, SurrenderedC));
    expect(sim.world.has(target, DownedC) || sim.world.has(target, DeadC) || sim.world.has(target, SurrenderedC)).toBe(true);
  });

  it('is rejected for a target on another ship, and keeps the walk it would have wiped', () => {
    const sim = setup(1);
    const [a] = crewOn(sim, 1);
    draft(sim, [a!]);
    const goal = tileOf(sim, crewOn(sim, 1)[3]!);
    sim.enqueue({ type: 'crew.moveTo', id: a!, x: goal.x, y: goal.y });
    sim.enqueue({ type: 'crew.attack', id: a!, target: foesOn(sim, 2)[0]! });
    expect(rejected(run(sim, 1))).toEqual(['otherShip']);
    expect(sim.world.get(a!, DraftedC)!.target).toEqual(goal);
  });
});

describe('re-boarding a docked shuttle', () => {
  it.each(SEEDS)('a drafted crew member on the enemy ship walks back and climbs in (seed %i)', (seed) => {
    const sim = setup(seed);
    const { shuttle, crew } = dockAndLand(sim, 3);
    expect(crew.length).toBeGreaterThan(0);
    const walker = crew[0]!;
    expect(shipIdOf(sim, sim.world.get(walker, PositionC))).toBe(nth(sim, 2));
    draft(sim, [walker]);
    sim.enqueue({ type: 'vehicle.embark', crew: walker, vehicle: shuttle });
    expect(rejected(run(sim, 1))).toEqual([]);
    run(sim, 20 * 60, () => sim.world.has(walker, AboardC));
    expect(sim.world.has(walker, AboardC)).toBe(true);
    expect(sim.world.get(shuttle, VehicleC)!.passengers.concat(sim.world.get(shuttle, VehicleC)!.pilot).includes(walker)).toBe(true);
  });

  it('an attack order or a walk order replaces the walk to the shuttle, and boarding replaces an attack order', () => {
    const sim = setup(1);
    const { shuttle, crew } = dockAndLand(sim, 3);
    const a = crew[0]!;
    draft(sim, [a]);
    sim.world.add(a, EquipC, { weapon: 'item.rifle' });
    const foe = foesOn(sim, 2)[0]!;
    sim.enqueue({ type: 'crew.attack', id: a, target: foe });
    run(sim, 1);
    sim.enqueue({ type: 'vehicle.embark', crew: a, vehicle: shuttle });
    run(sim, 1);
    expect(sim.world.get(a, FighterC)!.ordered).toBe(0);
    expect(sim.world.has(a, EmbarkOrderC)).toBe(true);
    const here = tileOf(sim, a);
    sim.enqueue({ type: 'crew.moveTo', id: a, x: here.x, y: here.y });
    run(sim, 1);
    expect(sim.world.has(a, EmbarkOrderC)).toBe(false);
  });
});

describe('side effects of the draft rules', () => {
  it('player crew stay on the player faction when drafted', () => {
    const sim = newGame(1, content);
    const [a] = crewOn(sim, 1);
    draft(sim, [a!]);
    expect(sim.world.get(a!, AllegianceC)?.faction).toBe('player');
    expect(sim.world.get(nth(sim, 1), ShipC)?.faction).toBe('player');
  });
});

describe('battle stations', () => {
  const consoleOf = (sim: Sim, n: number, kind: string): number =>
    sim.world.query(ModuleC).find((i) => shipIdOf(sim, sim.world.get(i, ModuleC)!) === nth(sim, n) && (content.modules[sim.world.get(i, ModuleC)!.def as keyof typeof content.modules] as ModuleDef).console === kind)!;

  it.each(SEEDS)('a drafted crew member walks to the weapons console and mans it, replacing the operator (seed %i)', (seed) => {
    const sim = setup(seed);
    const weapons = consoleOf(sim, 1, 'weapons');
    run(sim, 20 * 20);
    const crew = crewOn(sim, 1).filter((c) => operatorOf(sim, weapons) !== c);
    const pick = crew[crew.length - 1]!;
    draft(sim, [pick]);
    sim.enqueue({ type: 'crew.man', id: pick, module: weapons });
    expect(rejected(run(sim, 1))).toEqual([]);
    run(sim, 20 * 60, () => operatorOf(sim, weapons) === pick);
    expect(operatorOf(sim, weapons)).toBe(pick);
    expect(sim.world.has(pick, DraftedC)).toBe(true);
  });

  it('holds the station outside combat while drafted, and a move order releases it', () => {
    const sim = newGame(1, content);
    run(sim, 5);
    const weapons = consoleOf(sim, 1, 'weapons');
    const pick = crewOn(sim, 1)[0]!;
    draft(sim, [pick]);
    sim.enqueue({ type: 'crew.man', id: pick, module: weapons });
    run(sim, 20 * 60, () => operatorOf(sim, weapons) === pick);
    run(sim, 40);
    expect(operatorOf(sim, weapons)).toBe(pick);
    const away = tileOf(sim, crewOn(sim, 1).find((c) => c !== pick)!);
    sim.enqueue({ type: 'crew.moveTo', id: pick, x: away.x, y: away.y });
    run(sim, 2);
    expect(operatorOf(sim, weapons)).toBe(0);
  });

  it.each(SEEDS)('an armed operator ordered to a console reaches it and stays while a boarder is in view (seed %i)', (seed) => {
    const sim = newGame(seed, content);
    run(sim, 5);
    const weapons = consoleOf(sim, 1, 'weapons');
    const pick = crewOn(sim, 1).find((c) => c)!;
    sim.world.add(pick, EquipC, { weapon: 'item.rifle' });
    draft(sim, [pick]);
    const [boarder] = spawnCrew(sim, nth(sim, 1), ['role.security']);
    sim.world.add(boarder!, AllegianceC, { faction: 'hostile' });
    sim.world.add(boarder!, EquipC, { weapon: 'item.sidearm' });
    sim.world.get(boarder!, HealthC)!.hp = 1e9;
    sim.world.get(boarder!, HealthC)!.max = 1e9;
    sim.enqueue({ type: 'crew.man', id: pick, module: weapons });
    run(sim, 20 * 90, () => operatorOf(sim, weapons) === pick);
    expect(operatorOf(sim, weapons)).toBe(pick);
    run(sim, 20 * 15);
    expect(operatorOf(sim, weapons)).toBe(pick);
    expect(sim.world.has(pick, DraftedC)).toBe(true);
  });

  it.each(SEEDS)('station relief never displaces a drafted operator who was ordered to the console (seed %i)', (seed) => {
    const sim = setup(seed);
    const weapons = consoleOf(sim, 1, 'weapons');
    run(sim, 20 * 30);
    // Someone who ranks operating low (a relief by priority), drafted and ordered to the console, with the operators by choice free.
    const pick = crewOn(sim, 1).find((c) => operatorOf(sim, weapons) !== c && sim.world.get(c, CrewC)!.role !== 'role.gunner')!;
    sim.world.get(pick, PrioritiesC)!.operating = 4;
    draft(sim, [pick]);
    sim.enqueue({ type: 'crew.man', id: pick, module: weapons });
    run(sim, 20 * 90, () => operatorOf(sim, weapons) === pick);
    expect(operatorOf(sim, weapons)).toBe(pick);
    run(sim, 20 * 40);
    expect(operatorOf(sim, weapons)).toBe(pick);
  });

  it('rejects an undrafted crew member, a non-console module and an enemy console', () => {
    const sim = setup(1);
    const [a] = crewOn(sim, 1);
    sim.enqueue({ type: 'crew.man', id: a!, module: consoleOf(sim, 1, 'weapons') });
    draft(sim, [a!]);
    sim.enqueue({ type: 'crew.man', id: a!, module: airlockOf(sim, 1) });
    sim.enqueue({ type: 'crew.man', id: a!, module: consoleOf(sim, 2, 'weapons') });
    expect(rejected(run(sim, 1))).toEqual(['badTarget', 'badTarget']);
  });
});
