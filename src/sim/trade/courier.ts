import { SiteRunC } from '../away/components';
import { boardingReserved } from '../boarding/reserve';
import { ShipC } from '../combat/components';
import { CrewC } from '../crew/components';
import type { Sim } from '../sim';
import { cargoCount } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { bayWorking } from '../vehicles/geometry';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { freeAirlock, playerShip } from './player';
import { TraderC, type Deal } from './types';

/**
 * Who carries a deal (#548): one rule for every carrier. A shuttle is a real vehicle of one of the two sides, never one made up for the run: the
 * player's free shuttle first, else the trader's own (a station's, stowed in its hangar or on its pad). A ship with no shuttle (a freighter, a liner)
 * trades only through the player's.
 */

export interface CourierPlan {
  courier: Deal['courier'];
  /** The shuttle that flies the run (the player's for 'you', the trader's for 'them'); 0 for a queued deal (picked when it reaches the front). */
  vehicle: number;
  /** The player airlock the goods come in at. */
  airlock: number;
  /** Units one trip of this courier carries each way; a larger order runs as several trips (trips.ts). */
  cap: number;
}

/** Vehicles tied up by a running deal. */
function busyVehicles(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const d of sim.trade.deals) if (d.vehicle && d.phase !== 'done' && d.phase !== 'failed') out.add(d.vehicle);
  return out;
}

/**
 * The one answer to "which shuttle of `ship` can carry goods now": a cargo shuttle of that ship (a hold, not a pod) at home with an empty hold and
 * no other job (a deal, a boarding, an away site), or why not ('noCourier': none at all; 'courierBusy': all busy). The player's may be docked or
 * flying free between jobs; another ship's must be stowed in a working bay or on its pad (it flies itself, nobody aboard). `queue` plans a deal
 * that waits behind another: only a boarding or an away site makes the shuttle unavailable then (its size is all that is asked).
 */
export function freeShuttle(sim: Sim, ship: number, queue = false): { vehicle: number; cap: number } | { error: string } {
  if (!ship) return { error: 'noCourier' };
  const npc = ship !== playerShip(sim);
  const busy = busyVehicles(sim);
  let error = 'noCourier';
  for (const id of [...sim.world.query(VehicleC)].sort((a, b) => a - b)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    const def = vehicleDefOf(sim, v);
    const cap = def?.cargo ?? 0;
    if (v.homeShip !== ship || cap <= 0 || def?.class === 'pod') continue;
    const away = (v.state === 'flying' && !!v.dest) || (npc && (v.state !== 'stowed' || !bayWorking(sim, v.home)));
    const inUse = busy.has(id) || cargoCount(v) > 0 || away || v.outbound;
    if ((inUse && !queue) || boardingReserved(sim, id) || sim.world.has(id, SiteRunC)) {
      error = 'courierBusy';
      continue;
    }
    return { vehicle: id, cap };
  }
  return { error };
}

/** The player's shuttle that can make a trade run, or a reason it cannot (`freeShuttle` of the player's ship). */
export const playerCourier = (sim: Sim, queue = false): { vehicle: number; cap: number } | { error: string } => freeShuttle(sim, playerShip(sim), queue);

/**
 * Decide who flies a deal and where the goods come in (and how much one trip carries: `cap`): the player's free shuttle, else the trader's.
 * Either carries goods both ways. `ownShuttle` forces the player's (a hiring run). `queue` plans a deal that waits behind another with the same
 * partner: the shuttle may still be busy with that one, so only its size is checked (the shuttle and airlock are picked at the front).
 * Errors: 'noCourier' (no shuttle on either side), 'courierBusy' (the player's is busy and the trader has none free), 'theirBusy' (the player has
 * none and the trader's is busy), 'noAirlock'.
 */
export function planCourier(sim: Sim, ship: number, ownShuttle = false, queue = false): CourierPlan | { error: string } {
  if (!sim.world.get(ship, TraderC) || !sim.world.has(ship, ShipC)) return { error: 'noTrader' };
  if (!playerShip(sim)) return { error: 'noShip' };
  const mine = playerCourier(sim, queue);
  if (!('error' in mine)) {
    if (queue) return { courier: 'you', vehicle: 0, airlock: 0, cap: mine.cap };
    const v = sim.world.get(mine.vehicle, VehicleC) as Vehicle;
    const airlock = freeAirlock(sim, mine.vehicle, v.state === 'docked' ? v.dock : 0);
    return airlock ? { courier: 'you', vehicle: mine.vehicle, airlock, cap: mine.cap } : { error: 'noAirlock' };
  }
  if (ownShuttle) return mine;
  const theirs = freeShuttle(sim, ship, queue);
  if ('error' in theirs) return { error: mine.error === 'courierBusy' ? 'courierBusy' : theirs.error === 'courierBusy' ? 'theirBusy' : 'noCourier' };
  if (queue) return { courier: 'them', vehicle: 0, airlock: 0, cap: theirs.cap };
  const airlock = freeAirlock(sim, theirs.vehicle);
  return airlock ? { courier: 'them', vehicle: theirs.vehicle, airlock, cap: theirs.cap } : { error: 'noAirlock' };
}


/**
 * A trader's (a station's) shuttle whose job is over flies itself home to its bay or pad, nobody aboard. True once it is stowed there, or when it
 * has nowhere to go (its bay lost: it stays where it is and no longer flies itself). The one rule for sending a station's shuttle home after a
 * trade run, a handover, an inspection or a contract.
 */
export function sendHome(sim: Sim, id: number): boolean {
  const v = sim.world.get(id, VehicleC);
  if (!v) return true;
  // People who left the world with the job (inspectors, contractors) are no longer aboard: it flies with nobody at the controls.
  if (v.pilot && !sim.world.has(v.pilot, CrewC)) v.pilot = 0;
  v.passengers = v.passengers.filter((c) => sim.world.has(c, CrewC));
  if (v.state === 'stowed' || !bayWorking(sim, v.home)) {
    v.autopilot = false;
    v.outbound = false;
    return true;
  }
  v.autopilot = true;
  if (v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: id });
  return false;
}
