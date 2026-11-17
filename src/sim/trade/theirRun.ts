import { makeHaul } from '../items/plan';
import { refKey, reservations } from '../items/stock';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DEFAULT_CARRY_CAPACITY, PLAN_INTERVAL } from '../tuning';
import { cargoCount, cargoOf, cargoTake } from '../vehicles/cargo';
import type { Vehicle } from '../vehicles/components';
import { dockError } from '../vehicles/handlers';
import { addCredits } from './credits';
import { BACK_SEC, DISPATCH_SEC, due, FLIGHT_SEC, LOAD_SEC, UNLOAD_SEC } from './dealTiming';
import { addStock, cancelCourierHauls, closeCourier, failDeal, setPhase, settleDeal, touchMarket } from './deals';
import { settleDock, startUnits } from './dockLedger';
import { freeAirlock, holding } from './player';
import { unitPrice } from './pricing';
import { stageGoods, stationWork, takeDelivery } from './stationDock';
import { TraderC, type Deal } from './types';

/**
 * A deal carried by the trader's own shuttle (`Deal.courier` 'them', #548): the same run as the player's, mirrored. The shuttle is real (a
 * station's, in its hangar or on its pad) and flies itself with nobody aboard. Phases:
 * 1. `dispatch`: at home, the bought goods are staged from the trader's stock into the station storage nearest its bay (stationDock.ts `stageGoods`).
 * 2. `load`: the station crew carry them into the stowed shuttle (out onto the pad in suits for a pad shuttle).
 * 3. `out`: it launches, flies over and docks at the player's airlock.
 * 4. `stationWork`: the far side. The player's crew unload what was bought (cargoJobs), then load what the player sold (its hold sealed). That is
 *    the exchange.
 * 5. `back`: it flies home to its bay or pad.
 * 6. `unload`: the station crew carry the player's goods into station storage; they become the trader's stock, and the deal settles.
 * The deal settles at the end as the player's does; once the exchange is done, a run that cannot finish still stands (`theirGiveUp`).
 */

/** Every given line is in the shuttle's hold. */
export const gaveAll = (sim: Sim, d: Deal): boolean => d.give.every((l) => cargoOf(sim, d.vehicle, l.item) >= l.count);

/** One planning round of the player's crew carrying the deal's given goods from the player's ship into the shuttle docked at its airlock. */
export function haulAboard(sim: Sim, d: Deal, v: Vehicle): void {
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

/** One tick of a trader's-shuttle deal in its phase (dealFlow.ts `step` has done the checks every deal shares). */
export function stepTheirs(sim: Sim, d: Deal, v: Vehicle): void {
  switch (d.phase) {
    case 'dispatch': return dispatch(sim, d, v);
    case 'load': return load(sim, d, v);
    case 'out': return out(sim, d, v);
    case 'stationWork': return farSide(sim, d, v);
    case 'back': return back(sim, d, v);
    case 'unload': return unload(sim, d, v);
    default:
  }
}

/** Step 1: the shuttle is home (it is sent home if it is not); the bought goods are staged beside its bay. Nothing to fetch: straight out. */
function dispatch(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > DISPATCH_SEC * TICK_HZ) return failDeal(sim, d, 'noDock');
  if (v.state !== 'stowed') {
    if (due(d) && v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
    return;
  }
  if (d.get.length === 0) return setPhase(sim, d, 'out');
  d.dock = { airlock: 0, staged: [] };
  stageGoods(sim, d);
  setPhase(sim, d, 'load');
}

/** Step 2: the station crew carry the staged goods into the stowed shuttle. */
function load(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return failDeal(sim, d, 'loadTimeout');
  if (!stationWork(sim, d, v, 'get')) return;
  settleDock(d); // all of it is in the hold: nothing of the deal is left at the station
  setPhase(sim, d, 'out');
}

/** Step 3: launch and dock at the player's airlock (another free one if that one was taken meanwhile). */
function out(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > FLIGHT_SEC * TICK_HZ) return failDeal(sim, d, 'flightTimeout');
  if (v.state === 'docked' && v.dock === d.airlock) {
    v.outbound = false; // the player's crew unload what was bought (cargoJobs)
    if (d.get.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'player' });
    return setPhase(sim, d, 'stationWork');
  }
  if (!due(d)) return;
  if (v.state === 'docked') return void sim.enqueue({ type: 'vehicle.undock', vehicle: d.vehicle });
  if (v.dest?.type === 'dock' && v.dest.airlock === d.airlock) return;
  if (dockError(sim, d.vehicle, d.airlock) !== null) d.airlock = freeAirlock(sim, d.vehicle) || d.airlock;
  sim.enqueue({ type: 'vehicle.dock', vehicle: d.vehicle, airlock: d.airlock });
}

/**
 * Step 4, docked at the player's airlock: the hold is emptied first (it holds only what was bought), then sealed and loaded with what the player
 * sold (it holds only that). When both are done the goods have changed hands and the shuttle leaves for home.
 */
function farSide(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > LOAD_SEC * TICK_HZ) return theirGiveUp(sim, d, v, 'loadTimeout');
  if (!v.outbound) {
    if (cargoCount(v) > 0) return;
    if (d.give.length > 0) v.outbound = true; // sealed: the cargo planner must not take back what the crew load
  }
  if (!gaveAll(sim, d)) return haulAboard(sim, d, v);
  leaveFar(sim, d);
}

/** The goods have changed hands at the player's airlock: the shuttle leaves for home with what the player sold. */
function leaveFar(sim: Sim, d: Deal): void {
  if (d.give.length > 0) sim.events.emit({ type: 'trade.delivered', deal: d.id, ship: d.ship, to: 'trader' });
  sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
  setPhase(sim, d, 'back');
}

/**
 * Given goods the player's crew did not load in time: the deal goes on without them, and the player pays the trader what it would have paid for
 * them (its buying price now), so a sale is never paid for goods not handed over. `d.give` keeps only what is aboard.
 */
function shortGiven(sim: Sim, d: Deal): void {
  let owed = 0;
  d.give = d.give.map((l) => {
    const n = Math.min(l.count, cargoOf(sim, d.vehicle, l.item));
    owed += (unitPrice(sim, d.ship, l.item, 'buy') ?? 0) * (l.count - n);
    return { item: l.item, count: n };
  }).filter((l) => l.count > 0);
  const pay = Math.min(Math.round(owed), Math.max(0, sim.trade.credits));
  const trader = sim.world.get(d.ship, TraderC);
  if (pay <= 0 || !trader) return;
  addCredits(sim, -pay);
  trader.credits += pay;
}

/** Step 5: fly home. Back in its bay or on its pad: unload what the player sold, or settle when nothing was. */
function back(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > BACK_SEC * TICK_HZ) return theirGiveUp(sim, d, v, 'noDock');
  if (v.state === 'stowed') {
    if (d.give.length === 0) return void settleDeal(sim, d);
    d.dock = { airlock: 0, staged: [] };
    startUnits(sim, d);
    return setPhase(sim, d, 'unload');
  }
  if (due(d) && v.dest?.type !== 'bay') sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
}

/** Step 6: the station crew carry the player's goods into station storage; they become the trader's stock and the deal settles. */
function unload(sim: Sim, d: Deal, v: Vehicle): void {
  if (d.timer > UNLOAD_SEC * TICK_HZ) return theirGiveUp(sim, d, v, 'unloadTimeout');
  if (!stationWork(sim, d, v, 'give')) return;
  takeDelivery(sim, d);
  settleDock(d);
  v.outbound = false;
  settleDeal(sim, d);
}

/**
 * The trader's run cannot finish (a timeout, the trader gone). At the player's airlock: the given goods not loaded are paid for (`shortGiven`), and
 * what was bought is settled by what was unloaded (`reconcileDelivery`), or, once loading had begun, the shuttle leaves with what is aboard. After
 * that (on the way home or unloading there): the deal stands, and the player's goods still aboard go straight into the trader's stock.
 */
export function theirGiveUp(sim: Sim, d: Deal, v: Vehicle, reason: string): void {
  if (d.phase !== 'back' && d.phase !== 'unload') {
    cancelCourierHauls(sim, d);
    shortGiven(sim, d);
    // Loading had begun, so everything bought is off: the shuttle leaves with what was loaded. Else what was bought is settled by what came off.
    if (v.outbound) return leaveFar(sim, d);
    return reconcileDelivery(sim, d, reason);
  }
  cancelCourierHauls(sim, d);
  if (d.dock) takeDelivery(sim, d);
  const trader = sim.world.get(d.ship, TraderC);
  for (const l of d.give) {
    const n = cargoTake(sim, d.vehicle, l.item, l.count);
    if (trader && n > 0) addStock(trader.stock, l.item, n);
  }
  touchMarket(sim, trader);
  settleDock(d);
  v.outbound = false;
  if (d.trip) { d.trip.rest = []; d.trip.stopped = reason; }
  settleDeal(sim, d);
}

/**
 * Settle what actually reached the player and refund the rest. The shuttle's hold held exactly `d.get` when it docked, so what is missing from it
 * was unloaded. The player pays for that part pro rata (by value) from the escrow (a barter counts it as delivered); the unpaid share is refunded and
 * only the undelivered goods go back to the trader's stock. Nothing delivered is a plain failure.
 */
export function reconcileDelivery(sim: Sim, d: Deal, reason: string): void {
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
      addCredits(sim, d.held - pay); // the undelivered share is refunded
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
