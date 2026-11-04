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

/** Take up to `count` units of an item from the grid's storage modules (first holding it first). Returns how many it got. */
export function takeStock(sim: Sim, shipId: number, item: string, count: number): number {
  let got = 0;
  for (const id of sim.world.query(StorageC)) {
    if (got >= count) break;
    if (shipIdOf(sim, sim.world.get(id, ModuleC)) === shipId) got += storageTake(sim, id, item, count - got);
  }
  return got;
}

/** Take one unit from the first storage module of the grid holding it. Returns false if none. */
export function consumeAmmo(sim: Sim, shipId: number, item: string): boolean {
  return takeStock(sim, shipId, item, 1) === 1;
}
