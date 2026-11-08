import { StorageC } from '../items/components';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import type { WeaponDef } from '../registry';
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

/** Units of ammo one shot (or volley) of the weapon spends. */
export function ammoNeed(def: Pick<WeaponDef, 'ammoPerShot'>): number {
  return def.ammoPerShot ?? 1;
}

/** True if the ship holds enough ammo for one shot of the weapon (always true for a weapon with no ammo). */
export function hasAmmo(sim: Sim, shipId: number, def: Pick<WeaponDef, 'ammo' | 'ammoPerShot'>): boolean {
  return !def.ammo || ammoCount(sim, shipId, def.ammo) >= ammoNeed(def);
}

/** Take `count` units (default 1) from the grid's storage, all or nothing. Returns false if the ship holds fewer. */
export function consumeAmmo(sim: Sim, shipId: number, item: string, count = 1): boolean {
  if (ammoCount(sim, shipId, item) < count) return false;
  return takeStock(sim, shipId, item, count) === count;
}
