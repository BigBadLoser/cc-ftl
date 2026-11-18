import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { cargoAdd, cargoCount, cargoTake } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { addStock, failDeal, isLive, setPhase, settleDeal, touchMarket } from './deals';
import { BACK_SEC, DISPATCH_SEC, due, FLIGHT_SEC, LOAD_SEC, REPEAT, UNLOAD_SEC } from './dealTiming';
import { gaveAll, haulAboard, stepTheirs, theirGiveUp } from './theirRun';
import { settleDock } from './dockLedger';
import { isStation, stageGoods, stationAirlock, stationWork, takeDelivery, unwindStation } from './stationDock';
import { bayAccessTile } from '../vehicles/geometry';
import { sendHome } from './courier';
import { dockError } from '../vehicles/handlers';
import { TraderC, type Deal } from './types';
import { stepHandover } from '../galaxy/handover';
import { boardRecruits, landRecruits, lostRecruit, recruitsAboard } from './recruitLand';
import { stepQueued } from './queue';

/** Advance every live deal one tick, and send finished couriers home. */
export function advanceDeals(sim: Sim): void {
  for (const d of [...sim.trade.deals]) {
    if (isLive(d)) step(sim, d);
    else if (d.vehicle && (d.courier === 'them' || d.phase === 'done' || d.reason === 'cancelled' || d.crew || d.handover)) parkCourier(sim, d);
  }
}

function step(sim: Sim, d: Deal): void {
  if (d.phase === 'queued') return stepQueued(sim, d);
  d.timer++;
  if (d.handover) return stepHandover(sim, d);
  const theirs = d.courier === 'them';
  // Past the exchange at the player's airlock, the trader's shuttle carries the player's goods home: what was traded stands.
  const farDone = theirs && (d.phase === 'back' || d.phase === 'unload');
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) {
    if (farDone) return lostAfterExchange(sim, d);
    // Shot down with the goods aboard: the payer is refunded, the goods are gone.
    return failDeal(sim, d, 'lost', theirs ? d.phase === 'out' || d.phase === 'stationWork' : d.phase === 'back' || d.phase === 'unload' || d.phase === 'exchange');
  }
  if (!sim.world.get(d.ship, TraderC) && !(d.crew && (d.phase === 'back' || d.phase === 'unload'))) {
    // The seller vanished: what already reached the player is settled like any stuck delivery, never refunded on top of keeping it.
    if (theirs && (farDone || d.phase === 'stationWork')) return theirGiveUp(sim, d, v, 'traderGone');
    return failDeal(sim, d, 'traderGone');
  }
  if (d.crew && (d.phase === 'out' || d.phase === 'dockStation' || d.phase === 'stationWork') && lostRecruit(sim, d)) return failDeal(sim, d, 'recruitGone');
  if (theirs) return stepTheirs(sim, d, v);
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

/** Step 1 (player's shuttle): get it docked at the player's airlock so crew can load it, or send it straight out if it carries nothing. */
function dispatch(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > DISPATCH_SEC * TICK_HZ) return failDeal(sim, d, 'noDock');
  if (d.give.length === 0) return setPhase(sim, d, 'out');
  if (v.state === 'docked' && v.dock === d.airlock) return setPhase(sim, d, 'load');
  if (v.state === 'docked' && due(d)) return void sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle }); // left over from the last trip, at the trader
  if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
}

/** Step 2: crew haul the goods from storage and floor stacks into the docked shuttle through the airlock's unloaders. */
function load(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'loadTimeout');
  if (gaveAll(sim, d)) return setPhase(sim, d, 'out');
  haulAboard(sim, d, v);
}

/**
 * Step 3: at a station, dock at a free station airlock (stationDock.ts); anywhere else, or with no station airlock free,
 * undock and fly to hover beside the trader's ship.
 */
function out(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > FLIGHT_SEC * TICK_HZ) return failDeal(sim, d, 'flightTimeout');
  if (d.via !== 'hover' && isStation(sim, d.ship)) {
    const airlock = stationAirlock(sim, d.ship, d.vehicle);
    if (airlock) {
      d.via = 'dock';
      d.dock = { airlock, staged: [] };
      return setPhase(sim, d, 'dockStation');
    }
    if (d.crew) return; // recruits cannot be fetched from a hover: wait for an airlock (the timeout calls it off)
    d.via = 'hover';
  }
  if (v.state === 'flying' && !v.dest && v.hover === d.ship) return setPhase(sim, d, 'exchange');
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
  if (d.get.length > 0) return setPhase(sim, d, 'back');
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
    return setPhase(sim, d, 'out');
  }
  if (v.state === 'docked' && v.dock === airlock) {
    stageGoods(sim, d);
    return setPhase(sim, d, 'stationWork');
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
    sim.events.emit({ type: 'trade.rerouted', deal: d.id, ship: d.ship }); // told, not silent: a dock nobody works is worth knowing about
    return setPhase(sim, d, 'out');
  }
  if (!stationWork(sim, d, v)) return;
  takeDelivery(sim, d);
  settleDock(d);
  v.outbound = false;
  if (d.give.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'trader' });
  sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  if (d.get.length > 0) return setPhase(sim, d, 'back');
  if (!settleDeal(sim, d)) sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 4 (hiring run, docked at the station): the recruits walk aboard; then the shuttle leaves for home. */
function recruitWork(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'boardTimeout');
  if (!boardRecruits(sim, d, due(d))) return;
  v.outbound = false;
  sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  setPhase(sim, d, 'back');
}

/**
 * Has the exchange happened by the time the player's shuttle is in `back` or `unload`, so that what the player paid for is physically theirs? One
 * decision for every timeout (the trader's shuttle has its own: theirRun.ts `theirGiveUp`):
 * - a trade run: yes. The give goods went to the trader and the get goods are in the shuttle's hold at the exchange, before `back`. The deal
 *   settles as done, the hold stays aboard (nothing is refunded or duplicated).
 * - a hiring run: once a recruit is aboard (boarding is its exchange): yes. The shuttle brings them home, so the hire completes (they
 *   step out at the shuttle's home bay, the fee is paid once). Before anyone boards: no, it fails, refunds, and they stay at the station.
 */
const exchanged = (sim: Sim, d: Deal): boolean => !d.crew || recruitsAboard(sim, d);

/** The trader's shuttle was lost on its way home after the exchange: the deal stands as traded (what the player sold was lost with it, the trader's loss). */
function lostAfterExchange(sim: Sim, d: Deal): void {
  if (d.trip) { d.trip.rest = []; d.trip.stopped = 'lost'; }
  if (d.dock) settleDock(d);
  d.vehicle = 0;
  settleDeal(sim, d);
}

/** A delivery that cannot be finished (no airlock to dock at, nobody or nowhere to unload): settle or refund by `exchanged`. */
function giveUp(sim: Sim, d: Deal, v: Vehicle, reason: string): void {
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
    return setPhase(sim, d, 'unload');
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
  if (!settleDeal(sim, d)) sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/**
 * After a run the shuttle flies itself home; once it is stowed (or gone) the deal lets it go. The player's is then a normal crewed shuttle again (its
 * return was ordered when the run ended). The trader's is sent home here, whatever ended the run, and waits in its bay or on its pad for the next
 * one (courier.ts `sendHome`).
 */
function parkCourier(sim: Sim, d: Deal): void {
  const v = sim.world.get(d.vehicle, VehicleC);
  if (d.courier === 'them') {
    if ((v?.state !== 'stowed' && (sim.tick + d.id) % REPEAT !== 0) || !sendHome(sim, d.vehicle)) return;
    d.vehicle = 0;
    return;
  }
  if (v && v.state !== 'stowed') return;
  if (v) v.autopilot = false;
  d.vehicle = 0;
}
