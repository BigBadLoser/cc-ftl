import { shipById } from '../combat/ships';
import { makeHaul } from '../items/plan';
import { reservations, refKey } from '../items/stock';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoAdd, cargoCount, cargoOf, cargoTake } from '../vehicles/cargo';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { undock } from '../vehicles/lifecycle';
import { addStock, failDeal, isLive, settleDeal } from './deals';
import { spawnCourier } from './courier';
import { storagesHolding } from './player';
import { isStation, stageGoods, stationAirlock, stationWork, takeDelivery, unwindStation } from './stationDock';
import { dockError } from '../vehicles/handlers';
import { TraderC, type Deal } from './types';

/** Ticks between repeats of a flight command a deal keeps asking for until the shuttle obeys. */
const REPEAT = 20;
/** Seconds a deal may wait for the shuttle to dock and for the crew to load it before it is called off. */
const DISPATCH_SEC = 120;
const LOAD_SEC = 300;
const FLIGHT_SEC = 240;

const due = (d: Deal): boolean => d.timer % REPEAT === 1;

/** Advance every live deal one tick, and send finished couriers home. */
export function advanceDeals(sim: Sim): void {
  for (const d of [...sim.trade.deals]) {
    if (isLive(d)) step(sim, d);
    else if (d.courier === 'them' && d.vehicle) dismissCourier(sim, d);
    else if (d.courier === 'you' && d.vehicle && (d.phase === 'done' || d.reason === 'cancelled')) parkCourier(sim, d);
  }
}

function step(sim: Sim, d: Deal): void {
  d.timer++;
  if (d.courier === 'them' && d.phase === 'dispatch') {
    d.vehicle = spawnCourier(sim, d);
    if (!d.vehicle) return failDeal(sim, d, 'noCourier');
    d.phase = 'back';
    d.timer = 0;
  }
  const v = sim.world.get(d.vehicle, VehicleC);
  if (!v) return failDeal(sim, d, 'lost', d.phase === 'back' || d.phase === 'unload' || d.phase === 'exchange');
  if (!sim.world.get(d.ship, TraderC)) return failDeal(sim, d, 'traderGone');
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
  if (due(d) && v.dest?.type !== 'dock') sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
}

/** Step 2: crew haul the goods from storage into the docked shuttle through the airlock's unloaders. */
function load(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'loadTimeout');
  if (d.give.every((l) => cargoOf(sim, d.vehicle, l.item) >= l.count)) return go(d, 'out');
  if (sim.tick % PLAN_INTERVAL !== 0 || v.state !== 'docked') return;
  const res = reservations(sim);
  for (const l of d.give) {
    let need = l.count - cargoOf(sim, d.vehicle, l.item) - (res.incoming.get(refKey('vehicle', d.vehicle, l.item)) ?? 0);
    for (const s of storagesHolding(sim, l.item)) {
      const avail = s.count - (res.out.get(refKey('storage', s.id, l.item)) ?? 0);
      const n = Math.min(need, avail, DEFAULT_CARRY_CAPACITY);
      if (n <= 0) continue;
      makeHaul(sim, res, 'hauling', s.shipId, { ref: { kind: 'storage', id: s.id }, x: s.x, y: s.y, avail }, { kind: 'vehicle', id: d.vehicle }, l.item, n);
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
  v.outbound = false;
  for (const l of d.get) cargoAdd(sim, d.vehicle, l.item, l.count);
  if (d.give.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'trader' });
  if (d.get.length > 0) return go(d, 'back');
  settleDeal(sim, d);
  sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 3b (station): fly over and dock at the reserved station airlock; if it cannot, fall back to the hover swap. */
function dockStation(sim: Sim, d: Deal, v: Vehicle): void {
  const airlock = d.dock?.airlock ?? 0;
  const lost = !airlock || (dockError(sim, d.vehicle, airlock) !== null && v.dock !== airlock);
  if (lost || d.timer > FLIGHT_SEC * TICK_HZ) {
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
  settleDeal(sim, d);
  sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 5: fly home and dock at the player's airlock. */
function back(sim: Sim, d: Deal, v: Vehicle): void {
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
  if (cargoCount(v) > 0) return;
  settleDeal(sim, d);
  if (d.courier === 'you') sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
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
