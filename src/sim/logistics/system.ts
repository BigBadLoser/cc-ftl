import { DraftedC } from '../crew/components';
import { ferryFree, ferryMode, isFerryRegion, isPickupRegion, regionItems } from '../ferry/pick';
import { startFerry } from '../ferry/start';
import { FerryC } from '../ferry/components';
import { pickPilot } from '../mining/pilot';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { sendToEmbark } from '../vehicles/embark';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { cancelTransfer } from './handlers';
import { releasePilot } from './pilot';
import { salvageWatch } from './salvage';
import { RETRY_TICKS } from './settle';
import { TransferC, type Transfer, type TransferBlock } from './components';

/** Queued orders look for a shuttle this often (ticks); a pilot walking to the bay gives up after this many seconds. */
const LOOK_EVERY = 10;
const BOARD_SEC = 60;

function block(sim: Sim, id: number, t: Transfer, reason: TransferBlock, retry = RETRY_TICKS / 4): void {
  if (t.status !== 'blocked' || t.reason !== reason) sim.events.emit({ type: 'transfer.blocked', order: id, reason });
  if (t.status !== 'blocked') t.since = sim.tick;
  t.status = 'blocked';
  t.reason = reason;
  t.retryAt = sim.tick + retry;
}

/** The next trip's cargo: what is left to move, clipped to what the pickup region holds now and to the hold. */
function tripItems(sim: Sim, t: Transfer, cap: number): ItemQty[] {
  const trip: ItemQty[] = [];
  let room = cap;
  for (const l of t.items) {
    const n = Math.min(l.count, regionItems(sim, t.from, l.item), room);
    if (n <= 0) continue;
    trip.push({ item: l.item, count: n });
    room -= n;
  }
  return trip;
}

function startTrip(sim: Sim, id: number, t: Transfer, vehicle: number): void {
  const v = sim.world.get(vehicle, VehicleC) as Vehicle;
  const trip = tripItems(sim, t, vehicleDefOf(sim, v)?.cargo ?? 0);
  const err = trip.length === 0 ? 'nothing' : startFerry(sim, { vehicle, from: t.from, to: t.to, items: trip, transfer: id });
  if (err) {
    releasePilot(sim, vehicle, t.pilot);
    t.vehicle = 0;
    t.pilot = 0;
    if (err === 'nothing') return stockGone(sim, id, t);
    return block(sim, id, t, err === 'noAirlock' ? 'noAirlock' : 'noShuttle');
  }
  t.status = 'underway';
  delete t.reason;
  t.since = sim.tick;
  t.vehicle = vehicle;
  sim.events.emit({ type: 'transfer.underway', order: id, vehicle, pilot: v.pilot, trip: t.trips + 1, items: trip.reduce((n, l) => n + l.count, 0) });
}

/** The pickup region has none of the order's goods left: salvage orders end quietly, a player's wait in case they come back. */
function stockGone(sim: Sim, id: number, t: Transfer): void {
  if (t.auto) cancelTransfer(sim, id, 'nothing');
  else block(sim, id, t, 'noStock');
}

/** A queued or blocked order tries to get a shuttle and a pilot. */
function assign(sim: Sim, id: number, t: Transfer, busy: Set<number>): void {
  if (t.retryAt < 0 || sim.tick < t.retryAt) return;
  if (!isPickupRegion(sim, t.from) || !isFerryRegion(sim, t.to)) return cancelTransfer(sim, id, 'lost');
  if (!t.items.some((l) => regionItems(sim, t.from, l.item) > 0)) return stockGone(sim, id, t);
  const free = [...sim.world.query(VehicleC)].filter((v) => !busy.has(v) && ferryFree(sim, v)).sort((a, b) => a - b);
  if (free.length === 0) return block(sim, id, t, 'noShuttle', LOOK_EVERY);
  const usable = free.filter((v) => ferryMode(sim, t.from, v) && ferryMode(sim, t.to, v));
  if (usable.length === 0) return block(sim, id, t, 'noAirlock');
  // A shuttle with a pilot already seated, then a stowed one (its pilot comes from the crew), then one out in space (flies itself).
  const seated = usable.find((v) => sim.world.get(v, VehicleC)?.pilot);
  const stowed = usable.filter((v) => sim.world.get(v, VehicleC)?.state === 'stowed');
  const pick = seated ?? stowed.find((v) => pickPilot(sim, sim.world.get(v, VehicleC) as Vehicle, pilotsOf(sim)) !== 0) ?? usable.find((v) => !stowed.includes(v));
  if (!pick) return block(sim, id, t, 'noPilot', LOOK_EVERY);
  busy.add(pick);
  const v = sim.world.get(pick, VehicleC) as Vehicle;
  if (v.pilot || v.state !== 'stowed') return startTrip(sim, id, t, pick);
  const pilot = pickPilot(sim, v, pilotsOf(sim));
  if (!pilot || sendToEmbark(sim, pilot, pick)) return block(sim, id, t, 'noPilot', LOOK_EVERY);
  Object.assign(t, { status: 'boarding', vehicle: pick, pilot, since: sim.tick });
  delete t.reason;
}

/** Crew reserved as pilots by orders now boarding. */
function pilotsOf(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const id of sim.world.query(TransferC)) {
    const p = sim.world.get(id, TransferC);
    if (p?.status === 'boarding') out.add(p.pilot);
  }
  return out;
}

/** The pilot walks to the bay; once aboard the trip starts. If they cannot get there, they are released and the order waits. */
function boarding(sim: Sim, id: number, t: Transfer): void {
  const v = sim.world.get(t.vehicle, VehicleC);
  if (v && v.pilot === t.pilot && ferryFree(sim, t.vehicle)) return startTrip(sim, id, t, t.vehicle);
  const walking = v && sim.world.get(t.pilot, DraftedC) && sim.tick - t.since < BOARD_SEC * TICK_HZ && ferryFree(sim, t.vehicle);
  if (walking) return;
  releasePilot(sim, t.vehicle, t.pilot);
  t.vehicle = 0;
  t.pilot = 0;
  block(sim, id, t, 'noPilot');
}

/**
 * Logistics: transfer orders (see logistics/components.ts) become shuttle trips by themselves. A queued order takes the lowest
 * free shuttle and the best free pilot on its home ship (highest piloting skill, so real pilots first); the pilot walks to the
 * bay, climbs in, and the trip is an ordinary ferry run (crew haul the load in, the shuttle flies, crew unload it, it comes back).
 * Orders that find no shuttle, pilot or dock wait and retry. Finished trips are booked by `settleTransfer`, called from the ferry
 * flow, which then lets the next trip start here. Also watches salvage sites (salvage.ts). Runs after the ferry system.
 */
export function logisticsSystem(sim: Sim): void {
  salvageWatch(sim);
  const ids = [...sim.world.query(TransferC)].sort((a, b) => a - b);
  if (ids.length === 0) return;
  const busy = new Set<number>();
  for (const id of ids) {
    const t = sim.world.get(id, TransferC);
    if (t && (t.status === 'boarding' || t.status === 'underway') && t.vehicle) busy.add(t.vehicle);
  }
  for (const id of ids) {
    const t = sim.world.get(id, TransferC);
    if (!t) continue;
    if (t.status === 'underway') {
      // The trip vanished (shuttle destroyed, or its run dropped without settling): back to the queue.
      if (!sim.world.has(t.vehicle, VehicleC) || sim.world.get(t.vehicle, FerryC)?.transfer !== id) {
        t.status = 'queued';
        t.vehicle = 0;
        t.pilot = 0;
        t.retryAt = sim.tick + LOOK_EVERY;
      }
    } else if (t.status === 'boarding') boarding(sim, id, t);
    else if ((sim.tick + id) % LOOK_EVERY === 0) assign(sim, id, t, busy);
  }
}
