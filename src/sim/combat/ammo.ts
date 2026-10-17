import { StorageC } from '../items/components';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';

/** Units of an item held in storage modules of a grid. */
export function ammoCount(sim: Sim, gridId: number, item: string): number {
  let n = 0;
  for (const id of sim.world.query(StorageC)) {
    if (sim.world.get(id, ModuleC)?.gridId === gridId) n += storageCount(sim, id, item);
  }
  return n;
}

/** Take one unit from the first storage module of the grid holding it. Returns false if none. */
export function consumeAmmo(sim: Sim, gridId: number, item: string): boolean {
  for (const id of sim.world.query(StorageC)) {
    if (sim.world.get(id, ModuleC)?.gridId === gridId && storageTake(sim, id, item, 1) === 1) return true;
  }
  return false;
}
