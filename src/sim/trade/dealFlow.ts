import { shipById } from '../combat/ships';
import { makeHaul } from '../items/plan';
import { reservations, refKey } from '../items/stock';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoAdd, cargoCount, cargoOf, cargoTake } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { undock } from '../vehicles/lifecycle';
import { addStock, cancelCourierHauls, closeCourier, failDeal, isLive, settleDeal, touchMarket } from './deals';
import type { ItemQty } from '../registry';
import { spawnCourier } from './courier';
import { holding } from './player';
import { isStation, stageGoods, stationAirlock, stationWork, takeDelivery, unwindStation } from './stationDock';
import { bayAccessTile } from '../vehicles/geometry';
import { dockError } from '../vehicles/handlers';
import { TraderC, type Deal } from './types';
import { stepHandover } from '../galaxy/handover';
import { boardRecruits, landRecruits, lostRecruit, recruitsAboard } from './recruitLand';

/** Ticks between repeats of a flight command a deal keeps asking for until the shuttle obeys. */
const REPEAT = 20;
/** Seconds a deal may wait for the shuttle to dock and for the crew to load it before it is called off. */
const DISPATCH_SEC = 120;
const LOAD_SEC = 300;
const FLIGHT_SEC = 240;
/** Seconds the shuttle gets to fly home and dock, and the crew to empty it, before the delivery is given up on (it must not block travel forever). */
const BACK_SEC = 240;
const UNLOAD_SEC = 300;

const due = (d: Deal): boolean => d.timer % REPEAT === 1;

/** Advance every live deal one tick, and send finished couriers home. */
export function advanceDeals(sim: Sim): void {
  for (const d of [...sim.trade.deals]) {
    if (isLive(d)) step(sim, d);
    else if (d.courier === 'them' && d.vehicle) dismissCourier(sim, d);
    else if (d.courier === 'you' && d.vehicle && (d.phase === 'done' || d.reason === 'cancelled' || d.crew || d.handover)) parkCourier(sim, d);
  }
}

function step(sim: Sim, d: Deal): void {
  d.timer++;
  if (d.handover) return stepHandover(sim, d);
  if (d.courier === 'them' && d.phase === 'dispatch') {
    d.vehicle = spawnCourier(sim, d);
    if (!d.vehicle) return failDeal(sim, d, 'noCourier');
    d.phase = 'back';
    d.timer = 0;
  }
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) return failDeal(sim, d, 'lost', d.phase === 'back' || d.phase === 'unload' || d.phase === 'exchange');
  if (!sim.world.get(d.ship, TraderC) && !(d.crew && (d.phase === 'back' || d.phase === 'unload'))) {
    // The seller vanished: what already reached the player is settled like any stuck delivery, never refunded on top of keeping it.
    if (d.courier === 'them' && (d.phase === 'back' || d.phase === 'unload')) return reconcileDelivery(sim, d, v, 'traderGone');
    return failDeal(sim, d, 'traderGone');
  }
  if (d.crew && (d.phase === 'out' || d.phase === 'dockStation' || d.phase === 'stationWork') && lostRecruit(sim, d)) return failDeal(sim, d, 'recruitGone');
  switch (d.phase) {
    case 'dispatch': return dispatch(sim, d, v);
    case 'load': return load(sim, d, v);
    case 'out': return out(sim, d, v);
    case 'dockStation': return dockStation(sim, d, v);
    case 'stationWork': return work(sim, d, v);
    case 'exchange': return exchange(sim, d, v);
    case 'back': return back(sim, d, v);
    case 'unload': return unload(sim, d, v);
    default:
  }
}

function go(d: Deal, phase: Deal['phase']): void {
  d.phase = phase;
  d.timer = 0;
}

/** Step 1 (player's shuttle): get it docked at the player's airlock so crew can load it, or send it straight out if it carries nothing. */
function dispatch(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > DISPATCH_SEC * TICK_HZ) return failDeal(sim, d, 'noDock');
  if (d.give.length === 0) return go(d, 'out');
  if (v.state === 'docked' && v.dock === d.airlock) return go(d, 'load');
  if (v.state === 'docked' && due(d)) return void sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle }); // left over from the last trip, at the trader
  if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
}

/** Step 2: crew haul the goods from storage and floor stacks into the docked shuttle through the airlock's unloaders. */
function load(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'loadTimeout');
  if (d.give.every((l) => cargoOf(sim, d.vehicle, l.item) >= l.count)) return go(d, 'out');
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked') return;
  const res = reservations(sim);
  for (const l of d.give) {
    let need = l.count - cargoOf(sim, d.vehicle, l.item) - (res.incoming.get(refKey('vehicle', d.vehicle, l.item)) ?? 0);
    for (const s of holding(sim, l.item)) {
      const avail = s.count - (res.out.get(refKey(s.kind, s.id, l.item)) ?? 0);
      const n = Math.min(need, avail, DEFAULT_CARRY_CAPACITY);
      if (n <= 0) continue;
      makeHaul(sim, res, 'hauling', s.shipId, { ref: { kind: s.kind, id: s.id }, x: s.x, y: s.y, avail }, { kind: 'vehicle', id: d.vehicle }, l.item, n);
      need -= n;
    }
  }
}

/**
 * Step 3: at a station, dock at a free station airlock (stationDock.ts); anywhere else, or with no station airlock free,
 * undock and fly to hover beside the trader's ship.
 */
function out(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > FLIGHT_SEC * TICK_HZ) return failDeal(sim, d, 'flightTimeout');
  if (d.courier === 'you' && d.via !== 'hover' && isStation(sim, d.ship)) {
    const airlock = stationAirlock(sim, d.ship, d.vehicle);
    if (airlock) {
      d.via = 'dock';
      d.dock = { airlock, staged: [] };
      return go(d, 'dockStation');
    }
    if (d.crew) return; // recruits cannot be fetched from a hover: wait for an airlock (the timeout calls it off)
    d.via = 'hover';
  }
  if (v.state === 'flying' && !v.dest && v.hover === d.ship) return go(d, 'exchange');
  if (!due(d)) return;
  if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  else if (v.dest?.type !== 'hover') sim.enqueue({ type: 'vehicle.hover', vehicle: d.vehicle, ship: d.ship });
}

/** Step 4: the cargo changes hands. Outbound goods go into the trader's stock; what the player bought goes into the hold. */
function exchange(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer < Math.round((sim.content.trade?.exchangeSec ?? 3) * TICK_HZ)) return;
  const trader = sim.world.get(d.ship, TraderC);
  for (const l of d.give) if (trader) addStock(trader.stock, l.item, cargoTake(sim, d.vehicle, l.item, l.count));
  touchMarket(sim, trader);
  v.outbound = false;
  for (const l of d.get) cargoAdd(sim, d.vehicle, l.item, l.count);
  if (d.give.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'trader' });
  if (d.get.length > 0) return go(d, 'back');
  if (!settleDeal(sim, d)) sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 3b (station): fly over and dock at the reserved station airlock; if it cannot, fall back to the hover swap. */
function dockStation(sim: Sim, d: Deal, v: Vehicle): void {
  const airlock = d.dock?.airlock ?? 0;
  const lost = !airlock || (dockError(sim, d.vehicle, airlock) !== null && v.dock !== airlock);
  if (lost || d.timer > FLIGHT_SEC * TICK_HZ) {
    if (d.crew) return failDeal(sim, d, 'noDock');
    d.via = 'hover';
    delete d.dock;
    return go(d, 'out');
  }
  if (v.state === 'docked' && v.dock === airlock) {
    stageGoods(sim, d);
    return go(d, 'stationWork');
  }
  if (!due(d)) return;
  if (v.state === 'docked') sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  else if (v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock });
}

/** Step 4 (station): the station crew haul both ways; then the goods change hands and the shuttle leaves. */
function work(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.crew) return recruitWork(sim, d, v);
  if (d.timer > LOAD_SEC * TICK_HZ) {
    // The station crew never got to it: put everything back and swap from a hover instead.
    unwindStation(sim, d);
    d.via = 'hover';
    delete d.dock;
    return go(d, 'out');
  }
  if (!stationWork(sim, d, v)) return;
  takeDelivery(sim, d);
  v.outbound = false;
  if (d.give.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'trader' });
  sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  if (d.get.length > 0) return go(d, 'back');
  if (!settleDeal(sim, d)) sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 4 (hiring run, docked at the station): the recruits walk aboard; then the shuttle leaves for home. */
function recruitWork(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'boardTimeout');
  if (!boardRecruits(sim, d, due(d))) return;
  v.outbound = false;
  sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  go(d, 'back');
}

/**
 * Has the exchange happened by the time a deal is in `back` or `unload`, so that what the player paid for is physically theirs? One decision
 * for every timeout:
 * - the player's shuttle (`you`): yes. The give goods went to the trader and the get goods are in the shuttle's hold at the exchange, before
 *   `back`. The deal settles as done, the hold stays aboard (nothing is refunded or duplicated).
 * - the trader's shuttle (`them`): no. It only carries the trader's goods (a deal with give goods always uses the player's shuttle, see
 *   `planCourier`), which reach the player when they are unloaded; the shuttle is dismissed when the deal ends, so a stuck delivery fails
 *   and refunds, and the goods go back to the trader.
 * - a hiring run: once a recruit is aboard (boarding is its exchange): yes. The shuttle brings them home, so the hire completes (they
 *   step out at the shuttle's home bay, the fee is paid once). Before anyone boards: no, it fails, refunds, and they stay at the station.
 */
const exchanged = (sim: Sim, d: Deal): boolean => d.courier === 'you' && (!d.crew || recruitsAboard(sim, d));

/**
 * The trader's shuttle timed out: settle what actually reached the player and refund the rest. The shuttle's hold started as exactly `d.get`,
 * so what is missing from it was unloaded. The player pays for that part pro rata (by value) from the escrow (a barter counts it as delivered);
 * the unpaid share is refunded and only the undelivered goods go back to the trader's stock. Nothing delivered is a plain failure.
 */
function reconcileDelivery(sim: Sim, d: Deal, v: Vehicle, reason: string): void {
  cancelCourierHauls(sim, d); // before reading the hold: nothing more can leave it this tick
  const delivered = d.get.map((l) => ({ item: l.item, count: l.count - Math.min(l.count, cargoOf(sim, d.vehicle, l.item)) }));
  const got = delivered.filter((l) => l.count > 0);
  if (got.length === 0) return failDeal(sim, d, reason);
  const left = d.get.map((l, i) => ({ item: l.item, count: l.count - (delivered[i] as ItemQty).count })).filter((l) => l.count > 0);
  const trader = sim.world.get(d.ship, TraderC);
  if (left.length > 0) {
    if (trader) for (const l of left) addStock(trader.stock, l.item, l.count);
    if (!d.barter && d.balance > 0) {
      // The agreed value of exactly what was delivered (shares fixed when the trip opened), not today's prices.
      const share = d.get.reduce((n, l, i) => n + ((d.getValue?.[i] ?? 0) * (delivered[i] as ItemQty).count) / l.count, 0);
      const pay = Math.min(d.held, Math.round(share));
      sim.trade.credits += d.held - pay; // the undelivered share is refunded
      d.held = pay;
      d.balance = pay;
    }
    d.get = got;
    touchMarket(sim, trader);
  }
  if (d.trip) { d.trip.rest = []; d.trip.stopped = reason; }
  closeCourier(sim, d); // what is left leaves with the shuttle (it went back to the trader's stock above)
  settleDeal(sim, d);
}

/** A delivery that cannot be finished (no airlock to dock at, nobody or nowhere to unload): settle or refund by `exchanged`. */
function giveUp(sim: Sim, d: Deal, v: Vehicle, reason: string): void {
  if (d.courier === 'them' && !d.crew) return reconcileDelivery(sim, d, v, reason);
  if (!exchanged(sim, d)) return failDeal(sim, d, reason);
  if (d.crew) {
    if (!landRecruits(sim, d, true)) return; // nowhere to step out yet (no walkable ship): the deal stays pending and tries again next tick
    settleDeal(sim, d);
    if (bayAccessTile(sim, v)) return void sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
    v.autopilot = false; // its bay is gone: nothing to fly home to
    return;
  }
  if (d.trip) { d.trip.rest = []; d.trip.stopped = reason; } // no further trips with a loaded hold
  v.outbound = false;
  settleDeal(sim, d);
  sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 5: fly home and dock at the player's airlock. */
function back(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > BACK_SEC * TICK_HZ) return giveUp(sim, d, v, 'noDock');
  if (v.state === 'docked' && v.dock !== d.airlock) {
    if (due(d)) sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
    return;
  }
  if (v.state === 'docked' && v.dock === d.airlock) {
    sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'player' });
    return go(d, 'unload');
  }
  if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
}

/** Step 6: crew haul the cargo out through the unloaders (cargoJobs does it); when the hold is empty, the deal settles. */
function unload(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > UNLOAD_SEC * TICK_HZ) return giveUp(sim, d, v, 'unloadTimeout');
  if (d.crew) {
    if (!landRecruits(sim, d)) return;
    settleDeal(sim, d);
    return void sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
  }
  if (cargoCount(v) > 0) return;
  if (!settleDeal(sim, d) && d.courier === 'you') sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** A trader's own shuttle that has been unloaded leaves for home and disappears when it gets there. */
function dismissCourier(sim: Sim, d: Deal): void {
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) return void (d.vehicle = 0);
  if (v.state === 'docked') undock(sim, d.vehicle, v);
  const home = shipById(sim, d.ship);
  if (!home || (v.hover === d.ship && !v.dest)) {
    sim.world.destroyEntity(d.vehicle);
    d.vehicle = 0;
  } else if (!v.dest) v.dest = { type: 'hover', ship: d.ship };
}

/** The player's shuttle flies itself home after a run; once it is stowed (or gone) it is a normal crewed shuttle again. */
function parkCourier(sim: Sim, d: Deal): void {
  const v = sim.world.get(d.vehicle, VehicleC);
  if (v && v.state !== 'stowed') return;
  if (v) v.autopilot = false;
  d.vehicle = 0;
}
