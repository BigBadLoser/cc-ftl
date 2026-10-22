import { CombatC } from '../combat/components';
import { packetCount, packetTake } from '../sector/packet';
import type { Sim } from '../sim';
import { takeItems } from '../story/effects';
import { playerStock } from '../story/world';
import { playerShipInfo } from './arrivals';

/** The item jumps burn. */
export const FUEL_ITEM = 'item.fuel';

/** True while the player's ship is a packet (in hyperspace): its cargo and drive are read from the packet, not the world. */
const inPacket = (sim: Sim): boolean => sim.sector.state === 'hyperspace' && !!sim.sector.packet;

/** Fuel the player's ship holds, in the world or in the hyperspace packet. */
export function fuelStock(sim: Sim): number {
  return inPacket(sim) ? packetCount(sim.sector.packet!, FUEL_ITEM) : playerStock(sim, FUEL_ITEM);
}

/** Burn fuel (from the packet while in hyperspace). Returns the units taken. */
export function burnFuel(sim: Sim, n: number): number {
  return inPacket(sim) ? packetTake(sim.sector.packet!, FUEL_ITEM, n) : takeItems(sim, FUEL_ITEM, n);
}

/** The player's FTL charge in seconds (read from the packet in hyperspace), or null when there is no ship. */
export function ftlCharge(sim: Sim): number | null {
  if (inPacket(sim)) {
    const p = sim.sector.packet!;
    const c = p.entities.find((e) => e.id === p.ship)?.c['combat'] as { ftl: number } | undefined;
    return c?.ftl ?? null;
  }
  const me = playerShipInfo(sim);
  return me ? sim.world.get(me.id, CombatC)?.ftl ?? null : null;
}

/** Spend FTL charge (the packet's combat component while in hyperspace). */
export function spendCharge(sim: Sim, seconds: number): void {
  if (inPacket(sim)) {
    const p = sim.sector.packet!;
    const c = p.entities.find((e) => e.id === p.ship)?.c['combat'] as { ftl: number } | undefined;
    if (c) c.ftl = Math.max(0, c.ftl - seconds);
    return;
  }
  const me = playerShipInfo(sim);
  const c = me ? sim.world.get(me.id, CombatC) : undefined;
  if (c) c.ftl = Math.max(0, c.ftl - seconds);
}
