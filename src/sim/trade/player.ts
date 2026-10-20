import { ShipC } from '../combat/components';
import { StorageC } from '../items/components';
import { storageAdd, storageCount, storageSpace, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { airlockWorking } from '../modules/airlock';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import { dockError } from '../vehicles/handlers';
import { gridIdOf } from '../regions';

/** The player's ship (ShipC entity): the lowest-id live ship of the player faction, or 0. */
export function playerShip(sim: Sim): number {
  for (const id of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    const s = sim.world.get(id, ShipC);
    if (s?.faction === 'player' && (s.state === 'active' || s.state === 'disabled')) return id;
  }
  return 0;
}

/** Storage modules on the player's ship, ascending id. */
function playerStorages(sim: Sim): number[] {
  const grid = sim.world.get(playerShip(sim), ShipC)?.gridId;
  return [...sim.world.query(StorageC, ModuleC)].filter((id) => gridIdOf(sim, sim.world.get(id, ModuleC)) === grid).sort((a, b) => a - b);
}

/** Units of an item in the player's storage. */
export function playerItems(sim: Sim, item: string): number {
  return playerStorages(sim).reduce((n, id) => n + storageCount(sim, id, item), 0);
}

/** Units of an item the player's storage could still take. */
export function playerRoom(sim: Sim, item: string): number {
  return playerStorages(sim).reduce((n, id) => n + storageSpace(sim, id, item), 0);
}

/** Take up to `n` units from the player's storage (instant fallback); returns how many came out. */
export function takeFromPlayer(sim: Sim, item: string, n: number): number {
  let left = n;
  for (const id of playerStorages(sim)) if (left > 0) left -= storageTake(sim, id, item, left);
  return n - left;
}

/** Put units into the player's storage (instant fallback); returns how many fit. */
export function giveToPlayer(sim: Sim, item: string, n: number): number {
  let left = n;
  for (const id of playerStorages(sim)) if (left > 0) left -= storageAdd(sim, id, item, left);
  return n - left;
}

/** Storage modules of the player's ship that hold an item, with how much (loading hauls take from these). */
export function storagesHolding(sim: Sim, item: string): { id: number; gridId: number; x: number; y: number; count: number }[] {
  const out = [];
  for (const id of playerStorages(sim)) {
    const m = sim.world.get(id, ModuleC);
    const count = storageCount(sim, id, item);
    if (m && count > 0) out.push({ id, gridId: gridIdOf(sim, m), x: m.x, y: m.y, count });
  }
  return out;
}

/** A working docking airlock on the player's ship that `vehicle` could dock at (preferring the one it is at), or 0. */
export function freeAirlock(sim: Sim, vehicle: number, prefer = 0): number {
  const grid = sim.world.get(playerShip(sim), ShipC)?.gridId;
  const ids = [...sim.world.query(AirlockC, ModuleC)]
    .filter((id) => gridIdOf(sim, sim.world.get(id, ModuleC)) === grid && airlockWorking(sim, id))
    .sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : a - b));
  return ids.find((id) => dockError(sim, vehicle, id) === null) ?? 0;
}
