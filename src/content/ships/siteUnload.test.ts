import { describe, expect, it } from 'vitest';
import { content } from '../index';
import { homeShip } from '../../sim/combat/ships';
import { ItemStackC, StorageC } from '../../sim/items/components';
import { storageAdd, storageSpace } from '../../sim/items/storage';
import { ModuleC } from '../../sim/modules/components';
import { shipIdAt, shipIdOf } from '../../sim/regions';
import { newGame } from '../../sim/newGame';
import { cargoAdd, cargoCount } from '../../sim/vehicles/cargo';
import { VehicleC } from '../../sim/vehicles/components';
import { unloadStep } from '../../sim/away/haul';

const SCRAP = 'item.scrap_hull';

describe('unloading a site shuttle at home (#408)', () => {
  it('puts the hold down beside the bay only as far as the home ship has storage room', () => {
    const sim = newGame(1, content);
    const home = homeShip(sim);
    const shuttle = [...sim.world.query(VehicleC)].find((v) => sim.world.get(v, VehicleC)!.homeShip === home)!;
    const stores = [...sim.world.query(StorageC, ModuleC)].filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)!) === home).sort((a, b) => a - b);
    for (const id of stores.slice(1)) sim.world.remove(id, StorageC);
    const keep = stores[0]!;
    storageAdd(sim, keep, SCRAP, storageSpace(sim, keep, SCRAP) - 3); // room for 3 units
    cargoAdd(sim, shuttle, SCRAP, 30);
    const loose = (): number => [...sim.world.query(ItemStackC)].reduce((n, id) => {
      const st = sim.world.get(id, ItemStackC)!;
      return n + (st.item === SCRAP && shipIdAt(sim, st.x, st.y) === home ? st.count : 0);
    }, 0);
    for (let i = 0; i < 10; i++) unloadStep(sim, shuttle, sim.tick - 40); // ten crate steps
    expect(loose()).toBe(3);
    expect(cargoCount(sim.world.get(shuttle, VehicleC)!)).toBe(27);
  });
});
