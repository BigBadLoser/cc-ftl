import { ShipC } from '../combat/components';
import { ItemStackC, StorageC } from '../items/components';
import { storageCount } from '../items/storage';
import { ModuleC } from '../modules/components';
import { airlockWorking } from '../modules/airlock';
import { AirlockC } from '../modules/airlock';
import type { Sim } from '../sim';
import { dockError } from '../vehicles/handlers';
import { shipIdAt, shipIdOf } from '../regions';

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
  const grid = playerShip(sim);
  return [...sim.world.query(StorageC, ModuleC)].filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === grid).sort((a, b) => a - b);
}

/** Loose stacks of an item on the player's ship's floor (mined ore at the pod bay, spilled cargo), ascending id. */
function playerFloorStacks(sim: Sim, item: string): number[] {
  const grid = playerShip(sim);
  return [...sim.world.query(ItemStackC)].filter((id) => {
    const s = sim.world.get(id, ItemStackC);
    return !!s && s.item === item && shipIdAt(sim, s.x, s.y) === grid;
  }).sort((a, b) => a - b);
}

/** Units of an item the player can trade away: in the ship's storage and in loose stacks on its floor (issue #222). */
export function playerItems(sim: Sim, item: string): number {
  return holding(sim, item).reduce((n, s) => n + s.count, 0);
}

/** Where the player's ship holds an item, storage first then floor stacks, with how much (loading hauls take from these). */
export function holding(sim: Sim, item: string): { kind: 'storage' | 'floor'; id: number; shipId: number; x: number; y: number; count: number }[] {
  const out: { kind: 'storage' | 'floor'; id: number; shipId: number; x: number; y: number; count: number }[] = [];
  for (const id of playerStorages(sim)) {
    const m = sim.world.get(id, ModuleC);
    const count = storageCount(sim, id, item);
    if (m && count > 0) out.push({ kind: 'storage', id, shipId: shipIdOf(sim, m), x: m.x, y: m.y, count });
  }
  for (const id of playerFloorStacks(sim, item)) {
    const s = sim.world.get(id, ItemStackC)!;
    out.push({ kind: 'floor', id, shipId: shipIdAt(sim, s.x, s.y), x: s.x, y: s.y, count: s.count });
  }
  return out;
}

/** A working docking airlock on the player's ship that `vehicle` could dock at (preferring the one it is at), or 0. */
export function freeAirlock(sim: Sim, vehicle: number, prefer = 0): number {
  const grid = playerShip(sim);
  const ids = [...sim.world.query(AirlockC, ModuleC)]
    .filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === grid && airlockWorking(sim, id))
    .sort((a, b) => (a === prefer ? -1 : b === prefer ? 1 : a - b));
  return ids.find((id) => dockError(sim, vehicle, id) === null) ?? 0;
}
