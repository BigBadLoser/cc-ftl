import { describe, expect, it } from 'vitest';
import { fixtureShip } from '../../test/support/sim';
import { stampShip } from './combat/ships';
import { ShipC, type Faction } from './combat/components';
import { CrewC, DeadC, PositionC } from './crew/components';
import { AllegianceC, PrisonerC, SurrenderedC } from './fight/components';
import { playerCrew as relationsPlayerCrew } from './fight/relations';
import { ItemStackC, StorageC } from './items/components';
import { playerStock } from './items/held';
import { ModuleC } from './modules/components';
import { setPackedGuard } from './packedGuard';
import { PLAYER, crewOf, isPlayers, mainShipIdOf, mainShipOf, modulesOf, shipsOf, sideOf, stockOf, storagesOf } from './side';
import { Sim } from './sim';
import { playerCrew, playerCrewPackedOk, playerModules, playerShips, playerShipsPackedOk, playerStorages } from './story/world';
import { playerShip, playerShipId, playerShipPackedOk } from './trade/player';
import { playerCrewOnShip } from './away/crew';
import { VehicleC } from './vehicles/components';

const rows = ['#####', '#___#', '#___#', '#####'];

interface World {
  sim: Sim;
  mine: number;
  second: number;
  enemy: number;
  wreck: number;
  crew: number;
  freeCrew: number;
  surrendered: number;
  prisoner: number;
  foe: number;
  onEnemy: number;
  storage: number;
  mod: number;
  stack: number;
  foreignStack: number;
  vehicle: number;
}

function build(): World {
  const sim = new Sim(1);
  const mine = fixtureShip(sim, { name: 'a', rows });
  const second = stampShip(sim, { name: 'b', rows }, { faction: 'player', state: 'prize', x: 60, y: 0 });
  const enemy = stampShip(sim, { name: 'c', rows }, { faction: 'hostile', state: 'active', x: 120, y: 0 });
  const wreck = stampShip(sim, { name: 'd', rows }, { faction: 'player', state: 'wreck', x: 180, y: 0 });
  const crewAt = (faction: Faction, x: number, y: number): number => {
    const id = sim.world.createEntity();
    sim.world.add(id, CrewC, { name: 'c', role: 'role.x', species: 'species.human', appearanceSeed: 1, activity: 'idle' } as never);
    sim.world.add(id, PositionC, { x, y, toX: x, toY: y, progress: 0, facing: 0 });
    sim.world.add(id, AllegianceC, { faction });
    return id;
  };
  const crew = crewAt('player', 1, 1);
  const freeCrew = crewAt('player', 2, 1);
  const surrendered = crewAt('player', 61, 1);
  sim.world.add(surrendered, SurrenderedC, { tick: 0 });
  const prisoner = crewAt('player', 62, 1);
  sim.world.add(prisoner, SurrenderedC, { tick: 0 });
  sim.world.add(prisoner, PrisonerC, { tick: 0 });
  const dead = crewAt('player', 1, 2);
  sim.world.add(dead, DeadC, {} as never);
  const foe = crewAt('hostile', 121, 1);
  const onEnemy = crewAt('player', 122, 1); // a boarder keeps its side
  const mod = sim.world.createEntity();
  sim.world.add(mod, ModuleC, { def: 'module.x', x: 1, y: 1, rot: 0, hp: 1, powerPriority: 3, enabled: true, powered: true, reservedBy: 0 } as never);
  const storage = sim.world.createEntity();
  sim.world.add(storage, ModuleC, { def: 'module.crate', x: 2, y: 2, rot: 0, hp: 1, powerPriority: 3, enabled: true, powered: true, reservedBy: 0 } as never);
  sim.world.add(storage, StorageC, { capacity: 4, filter: null, stacks: [{ item: 'item.ore', count: 5 }] });
  const stack = sim.world.createEntity();
  sim.world.add(stack, ItemStackC, { item: 'item.ore', count: 3, x: 3, y: 1 });
  const foreignStack = sim.world.createEntity();
  sim.world.add(foreignStack, ItemStackC, { item: 'item.ore', count: 100, x: 121, y: 2 });
  const vehicle = sim.world.createEntity();
  sim.world.add(vehicle, VehicleC, { def: 'vehicle.x', homeShip: enemy, home: 0, state: 'stowed', hp: 1, pilot: 0, passengers: [], dest: null } as never);
  return { sim, mine, second, enemy, wreck, crew, freeCrew, surrendered, prisoner, foe, onEnemy, storage, mod, stack, foreignStack, vehicle };
}

describe('sideOf / isPlayers', () => {
  const w = build();
  const { sim } = w;

  it('reads a ship from its faction', () => {
    expect(sideOf(sim, w.mine)).toBe(PLAYER);
    expect(sideOf(sim, w.enemy)).toBe('hostile');
    expect(isPlayers(sim, w.second)).toBe(true);
    expect(isPlayers(sim, w.enemy)).toBe(false);
  });

  it('reads crew from allegiance, wherever they stand', () => {
    expect(sideOf(sim, w.crew)).toBe(PLAYER);
    expect(sideOf(sim, w.foe)).toBe('hostile');
    expect(sideOf(sim, w.onEnemy)).toBe(PLAYER);
  });

  it('puts a prisoner on its holder, the player when none is named', () => {
    expect(sideOf(sim, w.prisoner)).toBe(PLAYER);
    sim.world.get(w.prisoner, PrisonerC)!.holder = 'hostile';
    expect(sideOf(sim, w.prisoner)).toBe('hostile');
    expect(isPlayers(sim, w.prisoner)).toBe(false);
    delete sim.world.get(w.prisoner, PrisonerC)!.holder;
  });

  it('puts a module, storage and stack on the side of the ship they are on', () => {
    expect(sideOf(sim, w.mod)).toBe(PLAYER);
    expect(sideOf(sim, w.storage)).toBe(PLAYER);
    expect(sideOf(sim, w.stack)).toBe(PLAYER);
    expect(sideOf(sim, w.foreignStack)).toBe('hostile');
  });

  it('puts a vehicle on its home ship, and a thing without a side on null', () => {
    expect(sideOf(sim, w.vehicle)).toBe('hostile');
    expect(sideOf(sim, sim.world.createEntity())).toBeNull();
  });
});

describe('collections by side', () => {
  const w = build();
  const { sim } = w;

  it('shipsOf drops wrecks and filters by state', () => {
    expect([...shipsOf(sim, PLAYER)]).toEqual([w.mine, w.second]);
    expect([...shipsOf(sim, PLAYER, { states: ['prize'] })]).toEqual([w.mine, w.second]);
    expect([...shipsOf(sim, PLAYER, { states: ['wreck'] })]).toEqual([w.wreck]);
    expect([...shipsOf(sim, 'hostile')]).toEqual([w.enemy]);
  });

  it('mainShipOf is the lowest-id active or disabled ship (a prize is not one)', () => {
    expect(mainShipOf(sim, PLAYER)).toBe(0);
    expect(mainShipOf(sim, 'hostile')).toBe(w.enemy);
    sim.world.get(w.second, ShipC)!.state = 'disabled';
    expect(mainShipOf(sim, PLAYER)).toBe(w.second);
    sim.world.get(w.mine, ShipC)!.state = 'active';
    expect(mainShipOf(sim, PLAYER)).toBe(w.mine);
    sim.world.get(w.mine, ShipC)!.state = 'prize';
    sim.world.get(w.second, ShipC)!.state = 'prize';
  });

  it('crewOf: living crew of a side, free drops the surrendered, on narrows to a ship', () => {
    expect(crewOf(sim, PLAYER)).toEqual([w.crew, w.freeCrew, w.surrendered, w.prisoner, w.onEnemy]);
    expect(crewOf(sim, PLAYER, { free: true })).toEqual([w.crew, w.freeCrew, w.onEnemy]);
    expect(crewOf(sim, PLAYER, { on: w.mine })).toEqual([w.crew, w.freeCrew]);
    expect(crewOf(sim, PLAYER, { on: w.enemy, free: true })).toEqual([w.onEnemy]);
    expect(crewOf(sim, 'hostile')).toEqual([w.foe]);
  });

  it("modulesOf, storagesOf and stockOf read the side's ships only", () => {
    expect(modulesOf(sim, PLAYER)).toEqual([w.mod, w.storage]);
    expect(modulesOf(sim, PLAYER, 'module.crate')).toEqual([w.storage]);
    expect(storagesOf(sim, PLAYER)).toEqual([w.storage]);
    expect(storagesOf(sim, PLAYER, { ship: w.mine })).toEqual([w.storage]);
    expect(storagesOf(sim, PLAYER, { ship: w.second })).toEqual([]);
    expect(stockOf(sim, PLAYER, 'item.ore')).toBe(8);
    expect(stockOf(sim, 'hostile', 'item.ore')).toBe(100);
    expect(stockOf(sim, PLAYER, 'item.none')).toBe(0);
  });
});

describe('while the ship is a hyperspace packet', () => {
  it('guards a read unless packedOk, and mainShipIdOf reads the packet', () => {
    const sim = new Sim(1);
    sim.sector.state = 'hyperspace';
    sim.sector.packet = { ship: 77, w: 1, h: 1, tiles: {}, entities: [] };
    setPackedGuard('throw');
    expect(() => shipsOf(sim, PLAYER)).toThrow(/shipsOf/);
    expect(() => mainShipOf(sim, PLAYER)).toThrow(/mainShipOf/);
    expect(() => crewOf(sim, PLAYER)).toThrow(/crewOf/);
    expect(() => modulesOf(sim, PLAYER)).toThrow(/shipsOf/);
    expect(() => storagesOf(sim, PLAYER)).toThrow(/shipsOf/);
    expect(() => stockOf(sim, PLAYER, 'item.ore')).toThrow(/stockOf/);
    expect(shipsOf(sim, PLAYER, { packedOk: true }).size).toBe(0);
    expect(mainShipOf(sim, PLAYER, { packedOk: true })).toBe(0);
    expect(crewOf(sim, PLAYER, { packedOk: true })).toEqual([]);
    expect(mainShipIdOf(sim, PLAYER)).toBe(77);
    expect(mainShipIdOf(sim, 'hostile')).toBe(0);
  });
});

describe('the player helpers are thin forms of side.ts', () => {
  const w = build();
  const { sim } = w;

  it('playerCrew (story) is crewOf free; the fight one counts the surrendered too', () => {
    expect(playerCrew(sim)).toEqual(crewOf(sim, PLAYER, { free: true }));
    expect(playerCrewPackedOk(sim)).toEqual(crewOf(sim, PLAYER, { free: true, packedOk: true }));
    expect(relationsPlayerCrew(sim)).toEqual(crewOf(sim, PLAYER));
    expect(relationsPlayerCrew(sim)).toContain(w.surrendered);
    expect(playerCrew(sim)).not.toContain(w.surrendered);
  });

  it('playerCrewOnShip is crewOf on a ship', () => {
    expect(playerCrewOnShip(sim, w.enemy)).toEqual(crewOf(sim, PLAYER, { on: w.enemy }));
    expect(playerCrewOnShip(sim, w.mine)).toEqual([w.crew, w.freeCrew]);
  });

  it('playerShips, playerShip, playerShipId', () => {
    expect(playerShips(sim)).toEqual(shipsOf(sim, PLAYER));
    expect(playerShipsPackedOk(sim)).toEqual(shipsOf(sim, PLAYER));
    expect(playerShip(sim)).toBe(mainShipOf(sim, PLAYER));
    expect(playerShipPackedOk(sim)).toBe(mainShipOf(sim, PLAYER));
    expect(playerShipId(sim)).toBe(mainShipIdOf(sim, PLAYER));
  });

  it('playerModules, playerStorages, playerStock', () => {
    expect(playerModules(sim)).toEqual(modulesOf(sim, PLAYER));
    expect(playerModules(sim, 'module.crate')).toEqual(modulesOf(sim, PLAYER, 'module.crate'));
    expect(playerStorages(sim)).toEqual(storagesOf(sim, PLAYER));
    expect(playerStock(sim, 'item.ore')).toBe(stockOf(sim, PLAYER, 'item.ore'));
  });
});
