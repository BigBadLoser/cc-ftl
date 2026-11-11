import { describe, expect, it } from 'vitest';
import { ModuleC } from '../sim';
import { fuelForDays, STATION_FUEL_DAYS } from '../sim/modules/energy';
import { drawFromStores, shipStoreCount } from '../sim/items/stock';
import { FOOD_EVERY } from '../sim/stations/food';
import { run, station } from './stationLifeFixture';
import { newGame } from '../sim';
import { spawnShip } from '../sim/combat/ships';
import { content } from './index';

const CRYSTAL = 'item.energy_crystal';

describe('station and ship fuel stock (#425)', () => {
  it('a station is stamped with days of crystals and the supply run refills what its reactors burned', () => {
    const { sim, st } = station('station.trading', 'station', 6);
    const want = fuelForDays(sim, st, CRYSTAL, STATION_FUEL_DAYS);
    const reactors = sim.world.query(ModuleC).filter((id) => sim.content.modules[sim.world.get(id, ModuleC)!.def]?.fuel);
    expect(reactors.length).toBeGreaterThan(0);
    expect(want).toBeGreaterThan(0);
    const full = shipStoreCount(sim, st, CRYSTAL);
    expect(full).toBeGreaterThanOrEqual(want);
    drawFromStores(sim, st, CRYSTAL, 10);
    expect(shipStoreCount(sim, st, CRYSTAL)).toBe(full - 10);
    run(sim, FOOD_EVERY + 1);
    expect(shipStoreCount(sim, st, CRYSTAL)).toBe(full);
  });

  it('a spawned enemy ship carries crystals in its stores', () => {
    const sim = newGame(3, content);
    const rows = ['##########', '#________#', '#________#', '#________#', '##########'];
    const mods = [{ def: 'module.reactor', x: 1, y: 1, rot: 0 }, { def: 'module.storage', x: 6, y: 1, rot: 0 }];
    const enemy = spawnShip(sim, { name: 'e', faction: 'hostile', rows, modules: mods }, { faction: 'hostile', x: 150, y: 60 });
    const mine = spawnShip(sim, { name: 'p', faction: 'player', rows, modules: mods }, { faction: 'player', x: 150, y: 90 });
    expect(shipStoreCount(sim, enemy, CRYSTAL)).toBe(fuelForDays(sim, enemy, CRYSTAL, 3));
    expect(shipStoreCount(sim, enemy, CRYSTAL)).toBeGreaterThan(0);
    expect(shipStoreCount(sim, mine, CRYSTAL)).toBe(0); // the player's template says what it carries
  });
});
