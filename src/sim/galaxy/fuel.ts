import { CombatC } from '../combat/components';
import { ItemStackC, StorageC } from '../items/components';
import { takeFromStack } from '../items/stacks';
import { storageCount, storageTake } from '../items/storage';
import { ModuleC } from '../modules/components';
import { shipIdAt, shipIdOf } from '../regions';
import { packetCount, packetTake } from '../sector/packet';
import type { Sim } from '../sim';
import { playerShip } from '../trade/player';

/** The item jumps burn. */
export const FUEL_ITEM = 'item.fuel';

/** True while the player's ship is a packet (in hyperspace): its cargo and drive are read from the packet, not the world. */
const inPacket = (sim: Sim): boolean => sim.sector.state === 'hyperspace' && !!sim.sector.packet;

/** Storage modules on one ship, ascending id. */
export const storagesOf = (sim: Sim, ship: number): number[] =>
  sim.world.query(StorageC, ModuleC).filter((id) => shipIdOf(sim, sim.world.get(id, ModuleC)) === ship).sort((a, b) => a - b);

/**
 * Fuel the flown ship holds, in the world (its storage modules and loose stacks on its tiles) or in the hyperspace packet. Only that
 * ship: other player-owned ships (prizes, a second ship) do not pay for it. `ship` defaults to the player's flown ship.
 */
export function fuelStock(sim: Sim, ship: number = playerShip(sim)): number {
  if (inPacket(sim)) return packetCount(sim.sector.packet!, FUEL_ITEM);
  let n = 0;
  for (const id of storagesOf(sim, ship)) n += storageCount(sim, id, FUEL_ITEM);
  for (const id of sim.world.query(ItemStackC)) {
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === FUEL_ITEM && shipIdAt(sim, s.x, s.y) === ship) n += s.count;
  }
  return n;
}

/** Burn fuel from the flown ship only (from the packet while in hyperspace). Returns the units taken. */
export function burnFuel(sim: Sim, n: number, ship: number = playerShip(sim)): number {
  if (inPacket(sim)) return packetTake(sim.sector.packet!, FUEL_ITEM, n);
  let left = n;
  for (const id of storagesOf(sim, ship)) left -= storageTake(sim, id, FUEL_ITEM, left);
  for (const id of sim.world.query(ItemStackC)) {
    if (left <= 0) break;
    const s = sim.world.get(id, ItemStackC);
    if (s?.item === FUEL_ITEM && shipIdAt(sim, s.x, s.y) === ship) left -= takeFromStack(sim, id, left);
  }
  return n - left;
}

const packetCombat = (sim: Sim): { ftl: number } | undefined => {
  const p = sim.sector.packet;
  return p?.entities.find((e) => e.id === p.ship)?.c['combat'] as { ftl: number } | undefined;
};

/** The flown ship's FTL charge in seconds (read from the packet in hyperspace), or null when there is no ship. */
export function ftlCharge(sim: Sim, ship: number = playerShip(sim)): number | null {
  if (inPacket(sim)) return packetCombat(sim)?.ftl ?? null;
  return sim.world.get(ship, CombatC)?.ftl ?? null;
}

/** Spend FTL charge (the packet's combat component while in hyperspace). */
export function spendCharge(sim: Sim, seconds: number, ship: number = playerShip(sim)): void {
  const c = inPacket(sim) ? packetCombat(sim) : sim.world.get(ship, CombatC);
  if (c) c.ftl = Math.max(0, c.ftl - seconds);
}
