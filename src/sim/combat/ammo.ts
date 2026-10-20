import { StorageC } from '../items/components';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';

/** Units of an item held in storage modules of a grid. */
export function ammoCount(sim: Sim, shipId: number, item: string): number {
  let n = 0;
  for (const id of sim.world.query(StorageC)) {
    if (shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId) n += storageCount(sim, id, item);
  }
  return n;
}

/** Take one unit from the first storage module of the grid holding it. Returns false if none. */
export function consumeAmmo(sim: Sim, shipId: number, item: string): boolean {
  for (const id of sim.world.query(StorageC)) {
    if (shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId && storageTake(sim, id, item, 1) === 1) return true;
  }
  return false;
}
