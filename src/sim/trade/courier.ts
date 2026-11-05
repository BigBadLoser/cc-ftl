import { SiteRunC } from '../away/components';
import { BodyC, ALT } from '../body';
import { boardingReserved } from '../boarding/reserve';
import { ShipC } from '../combat/components';
import type { ItemQty, VehicleDef } from '../registry';
import type { Sim } from '../sim';
import { cargoCount } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { freeAirlock, playerShip } from './player';
import { TraderC, type Deal } from './types';

export interface CourierPlan {
  courier: Deal['courier'];
  /** The player's shuttle (courier 'you'), else 0. */
  vehicle: number;
  /** The player airlock the goods come in at. */
  airlock: number;
  /** Units one trip of this courier carries each way; a larger order runs as several trips (trips.ts). */
  cap: number;
}

/** The shuttle type a trader's own courier uses: the first cargo-carrying vehicle of class 'shuttle' (stable order). Pods are never couriers. */
export function courierDef(sim: Sim): { id: string; def: VehicleDef } | null {
  for (const id of Object.keys(sim.content.vehicles ?? {}).sort()) {
    const def = sim.content.vehicles?.[id];
    if (def && def.class === 'shuttle' && (def.cargo ?? 0) > 0) return { id, def };
  }
  return null;
}

/** Vehicles tied up by a running deal. */
function busyVehicles(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const d of sim.trade.deals) if (d.vehicle && d.phase !== 'done' && d.phase !== 'failed') out.add(d.vehicle);
  return out;
}

/** The player's shuttle that can make a trade run, or a reason it cannot. */
export function playerCourier(sim: Sim, queue = false): { vehicle: number; cap: number } | { error: string } {
  const me = playerShip(sim);
  const busy = busyVehicles(sim);
  let error = 'noCourier';
  for (const id of [...sim.world.query(VehicleC)].sort((a, b) => a - b)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    const cap = vehicleDefOf(sim, v)?.cargo ?? 0;
    if (v.homeShip !== me || cap <= 0 || vehicleDefOf(sim, v)?.class === 'pod') continue;
    // A shuttle that belongs to a boarding (launching, recalling, or waiting at the enemy for the party) or a salvage shift is not free either.
    // A queued deal is planned for the shuttle's size while an earlier deal still has it: only a boarding or salvage shift makes it unavailable then.
    const inUse = busy.has(id) || cargoCount(v) > 0 || (v.state === 'flying' && v.dest) || v.outbound;
    if ((inUse && !queue) || boardingReserved(sim, id) || sim.world.has(id, SiteRunC)) {
      error = 'courierBusy';
      continue;
    }
    return { vehicle: id, cap };
  }
  return { error };
}

/**
 * Decide who flies a deal and where the goods come in (and how much one trip carries: `cap`). Goods the player hands over always travel on the player's shuttle,
 * and so do goods from a seller with no shuttle of its own (stations included); otherwise the seller sends its own.
 * `ownShuttle` forces the player's (a hiring run). `queue` plans a deal that waits behind another with the same partner: the shuttle may still be busy
 * with that one, so only its size (and a free airlock) is checked.
 */
export function planCourier(sim: Sim, ship: number, give: readonly ItemQty[], get: readonly ItemQty[], ownShuttle = false, queue = false): CourierPlan | { error: string } {
  const trader = sim.world.get(ship, TraderC);
  if (!trader) return { error: 'noTrader' };
  if (!sim.world.has(ship, ShipC)) return { error: 'noTrader' };
  if (!playerShip(sim)) return { error: 'noShip' };
  const kind = sim.content.trade?.traders[trader.profile];
  if (ownShuttle || give.length > 0 || !kind?.shuttle) {
    const c = playerCourier(sim, queue);
    if ('error' in c) return c;
    const v = sim.world.get(c.vehicle, VehicleC) as Vehicle;
    if (queue) return { courier: 'you', vehicle: c.vehicle, airlock: 0, cap: c.cap }; // the airlock is picked when the deal reaches the front
    const airlock = freeAirlock(sim, c.vehicle, v.state === 'docked' ? v.dock : 0);
    return airlock ? { courier: 'you', vehicle: c.vehicle, airlock, cap: c.cap } : { error: 'noAirlock' };
  }
  const cd = courierDef(sim);
  if (!cd) return { error: 'noCourier' };
  if (queue) return { courier: 'them', vehicle: 0, airlock: 0, cap: cd.def.cargo ?? 0 };
  const airlock = freeAirlock(sim, 0);
  return airlock ? { courier: 'them', vehicle: 0, airlock, cap: cd.def.cargo ?? 0 } : { error: 'noAirlock' };
}

/** Create the trader's own shuttle at its ship, loaded with the goods and bound for the player's airlock. */
export function spawnCourier(sim: Sim, deal: Deal): number {
  const cd = courierDef(sim);
  const s = sim.world.get(deal.ship, ShipC);
  if (!cd || !s) return 0;
  const id = sim.world.createEntity();
  sim.world.add(id, VehicleC, {
    def: cd.id, homeShip: deal.ship, home: 0, state: 'flying', hp: cd.def.maxHp, pilot: 0, passengers: [],
    dest: { type: 'dock', airlock: deal.airlock }, dock: 0, cargo: deal.get.map((l) => ({ ...l })),
  });
  sim.world.add(id, BodyC, { x: s.x + s.width / 2, y: s.y + s.height / 2, heading: 0, alt: ALT.cruise });
  return id;
}
