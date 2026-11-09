import { StorageC } from '../items/components';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { moduleShip, modulesWhere, type ModuleList } from '../modules/byShip';
import type { WeaponDef } from '../registry';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';

/**
 * The storage entities on each ship (`shipIdOf` of their module; 0 without one), ascending ids. Kept while the storage set and the module
 * index (modules/byShip.ts: the module set, positions, ships and their rectangles, the owner layer) are unchanged. A cache, never saved.
 */
const storageIndex = new WeakMap<Sim, { storages: readonly number[]; mods: ModuleList; byShip: Map<number, number[]> }>();

function storagesOn(sim: Sim, shipId: number): readonly number[] {
  const storages = sim.world.query(StorageC);
  const mods = modulesWhere(sim, null);
  let idx = storageIndex.get(sim);
  if (!idx || idx.storages !== storages || idx.mods !== mods) {
    const byShip = new Map<number, number[]>();
    for (const id of storages) {
      const m = sim.world.get(id, ModuleC);
      const ship = m && sim.content.modules[m.def] ? moduleShip(sim, id) : shipIdOf(sim, m);
      const on = byShip.get(ship);
      if (on) on.push(id);
      else byShip.set(ship, [id]);
    }
    storageIndex.set(sim, (idx = { storages, mods, byShip }));
  }
  return idx.byShip.get(shipId) ?? NONE;
}
const NONE: readonly number[] = [];

/** Units of an item held in storage modules of a grid. */
export function ammoCount(sim: Sim, shipId: number, item: string): number {
  let n = 0;
  for (const id of storagesOn(sim, shipId)) n += storageCount(sim, id, item);
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
