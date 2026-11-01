import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { bumpStat } from '../story/goals';
import { FUEL_ITEM } from '../galaxy/fuel';
import { settlement, type OfferCheck } from './offers';
import { unitPrice } from './pricing';
import { TraderC, type Deal, type Offer, type Trader, type Trip } from './types';
import type { CourierPlan } from './courier';
import { releaseRecruits } from './recruitLand';
import { canStart } from './trips';
import { undock } from '../vehicles/lifecycle';
import { destroyJob } from '../items/stacks';
import { JobC } from '../crew/components';
import { addCredits } from './credits';

/**
 * Stop crew taking anything more out of a trader's shuttle: remove every haul job that still has to pick up from it (a crew member already
 * carrying a stack keeps it: those goods have left the hold). Call it before any accounting of what was delivered.
 */
export function cancelCourierHauls(sim: Sim, d: Deal): void {
  if (!d.vehicle) return;
  for (const id of [...sim.world.query(JobC)]) {
    const h = sim.world.get(id, JobC)?.haul;
    if (h && h.phase === 'pickup' && h.src.kind === 'vehicle' && h.src.id === d.vehicle) destroyJob(sim, id);
  }
}

/**
 * Tear down a trader's shuttle when its deal ends early, the one place for it: cancel the pending pickups, then empty the hold (what was
 * delivered is already out; the rest goes back to the trader's stock in the caller's accounting, and the shuttle is dismissed next tick).
 * Nothing later in the same tick (the crew work step runs after trade) can take from it. The player's own shuttle keeps its hold.
 */
export function closeCourier(sim: Sim, d: Deal): void {
  if (d.courier !== 'them' || !d.vehicle) return;
  cancelCourierHauls(sim, d);
  const v = sim.world.get(d.vehicle, VehicleC);
  if (v) v.cargo = [];
}

/** Finished deals kept for the UI's history. */
export const DEAL_HISTORY = 8;

export const isLive = (d: Deal): boolean => d.phase !== 'done' && d.phase !== 'failed';

/** The running deal with a trader, if any. */
export function liveDealWith(sim: Sim, ship: number): Deal | undefined {
  return sim.trade.deals.find((d) => d.ship === ship && isLive(d));
}

/**
 * Turn an offer into a deal: hold the payer's credits in escrow (paid out on delivery), take the goods the trader sells out
 * of its stock, and, for the player's shuttle carrying outbound goods, seal its hold so the cargo planner leaves it alone.
 * `check` is the offer re-validated just now and `plan` the courier chosen for it.
 */
/**
 * A live port's stock changed outside a galaxy turn (a player deal moved goods in or out): bump the galaxy revision so the starmap's market summary
 * (cheap and dear goods, built per revision) is rebuilt. Plain station traders (no port) are not on the map. A counter bump is all it costs.
 */
export function touchMarket(sim: Sim, trader: { port?: string } | undefined): void {
  if (trader?.port) sim.galaxy.rev++;
}

export function openDeal(sim: Sim, offer: Offer, check: OfferCheck, plan: CourierPlan, trips: Trip[] = []): Deal {
  const trader = sim.world.get(offer.ship, TraderC);
  const first = trips[0];
  const deal: Deal = {
    id: sim.trade.nextId++, ship: offer.ship, give: first?.give ?? check.give, get: first?.get ?? check.get, barter: offer.barter, balance: first?.balance ?? offer.balance,
    held: 0, courier: plan.courier, phase: 'dispatch', vehicle: plan.vehicle, airlock: plan.airlock, timer: 0, tick: sim.tick,
  };
  if (trips.length > 1) deal.trip = { n: 1, of: trips.length, rest: trips.slice(1) };
  holdTrip(sim, deal, trader);
  const v = plan.vehicle ? sim.world.get(plan.vehicle, VehicleC) : undefined;
  if (v && deal.courier === 'you') v.autopilot = true;
  if (v && deal.give.length > 0) v.outbound = true;
  sim.trade.deals.push(deal);
  sim.trade.offers = sim.trade.offers.filter((o) => o.id !== offer.id);
  return deal;
}

/** Each `get` line's share of the price, fixed now (before the goods leave the trader's stock and move its prices); the shares sum to the balance. */
function agreedValues(sim: Sim, d: Deal): number[] {
  const raw = d.get.map((l) => (unitPrice(sim, d.ship, l.item, 'sell') ?? 1) * l.count);
  const total = raw.reduce((n, v) => n + v, 0);
  const target = Math.max(0, d.balance);
  const out = raw.map((v) => (total > 0 ? Math.floor((v * target) / total) : 0));
  if (out.length > 0) out[out.length - 1] = (out[out.length - 1] as number) + target - out.reduce((n, v) => n + v, 0);
  return out;
}

/** Put a deal's current trip in escrow: the payer's credits are held, and the goods the trader sells leave its stock. */
function holdTrip(sim: Sim, d: Deal, trader: Trader | undefined): void {
  const pay = settlement(d);
  d.getValue = agreedValues(sim, d);
  if (pay > 0) sim.trade.credits -= pay;
  else if (trader) trader.credits += pay;
  if (trader) for (const l of d.get) takeStock(trader.stock, l.item, l.count);
  touchMarket(sim, trader);
  d.held = Math.abs(pay);
}

export function takeStock(stock: { item: string; count: number }[], item: string, count: number): void {
  const s = stock.find((x) => x.item === item);
  if (!s) return;
  s.count -= count;
  if (s.count <= 0) stock.splice(stock.indexOf(s), 1);
}

export function addStock(stock: { item: string; count: number }[], item: string, count: number): void {
  const s = stock.find((x) => x.item === item);
  if (s) s.count += count;
  else stock.push({ item, count });
}

/**
 * Pay the escrow to the other side. A multi-trip order then goes on to its next trip (true: the shuttle is not sent home) if that trip
 * can start; if it cannot (the trader ran out, the player spent the credits), the order ends here with the trips already settled.
 */
export function settleDeal(sim: Sim, d: Deal): boolean {
  const trader = sim.world.get(d.ship, TraderC);
  if (d.balance > 0 && !d.barter) {
    if (trader) trader.credits += d.held;
  } else if (d.balance < 0 && !d.barter) addCredits(sim, d.held);
  const amount = d.barter ? 0 : d.balance;
  d.held = 0;
  sim.events.emit({ type: 'trade.settled', deal: d.id, ship: d.ship, credits: amount });
  if (d.get.some((q) => q.item === FUEL_ITEM && q.count > 0)) bumpStat(sim, 'fuelBought');
  const next = d.trip?.rest[0];
  if (d.trip && next && d.vehicle) {
    if (canStart(sim, d.ship, next, d.barter)) return startTrip(sim, d, next);
    d.trip.stopped = 'short';
  }
  d.phase = 'done';
  d.timer = 0;
  if (d.trip) d.trip.rest = [];
  bumpStat(sim, 'trades');
  trimHistory(sim);
  return false;
}

/** Begin the next trip of a running order: hold its escrow and send the shuttle for it. */
function startTrip(sim: Sim, d: Deal, t: Trip): boolean {
  const trip = d.trip as NonNullable<Deal['trip']>;
  trip.rest.shift();
  trip.n++;
  d.give = t.give;
  d.get = t.get;
  d.balance = t.balance;
  holdTrip(sim, d, sim.world.get(d.ship, TraderC));
  const v = sim.world.get(d.vehicle, VehicleC);
  if (v && d.courier === 'them') {
    // The trader's shuttle is empty and done: it leaves, and a fresh one comes with the next load.
    if (v.state === 'docked') undock(sim, d.vehicle, v);
    sim.world.destroyEntity(d.vehicle);
    d.vehicle = 0;
  } else if (v && d.give.length > 0) v.outbound = true;
  delete d.dock;
  delete d.via;
  d.phase = 'dispatch';
  d.timer = 0;
  return true;
}

/**
 * End a deal that will not finish. The escrow goes back to the payer. Goods the trader set aside return to its stock unless
 * the shuttle already flew them (`lost`: shot down after the exchange; the payer is refunded but the goods are gone).
 */
export function failDeal(sim: Sim, d: Deal, reason: string, lost = false): void {
  closeCourier(sim, d);
  const trader = sim.world.get(d.ship, TraderC);
  if (d.balance > 0 && !d.barter) addCredits(sim, d.held);
  else if (d.balance < 0 && !d.barter && trader) trader.credits += d.held;
  if (trader && !lost) for (const l of d.get) addStock(trader.stock, l.item, l.count);
  touchMarket(sim, trader);
  d.held = 0;
  d.phase = 'failed';
  d.reason = reason;
  if (d.trip) d.trip.rest = []; // the trips still to come were never started: nothing is held for them
  d.timer = 0;
  const v = d.vehicle ? sim.world.get(d.vehicle, VehicleC) : undefined;
  if (v) {
    v.outbound = false;
    v.autopilot = false;
  }
  if (d.crew) {
    // A hiring run called off: the recruits go back to the station, and the shuttle flies home (parkCourier clears its autopilot there).
    releaseRecruits(sim, d);
    if (v && v.state !== 'stowed') {
      v.autopilot = true;
      sim.enqueue({ type: 'vehicle.return', vehicle: d.vehicle });
    }
  }
  sim.events.emit({ type: 'trade.failed', deal: d.id, ship: d.ship, reason });
  trimHistory(sim);
}

function trimHistory(sim: Sim): void {
  const done = sim.trade.deals.filter((d) => !isLive(d));
  for (const d of done.slice(0, Math.max(0, done.length - DEAL_HISTORY))) sim.trade.deals.splice(sim.trade.deals.indexOf(d), 1);
}
