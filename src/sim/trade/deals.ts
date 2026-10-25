import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { bumpStat } from '../story/goals';
import { FUEL_ITEM } from '../galaxy/fuel';
import { settlement, type OfferCheck } from './offers';
import { TraderC, type Deal, type Offer } from './types';
import type { CourierPlan } from './courier';

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

export function openDeal(sim: Sim, offer: Offer, check: OfferCheck, plan: CourierPlan): Deal {
  const trader = sim.world.get(offer.ship, TraderC);
  const pay = settlement(offer);
  if (pay > 0) sim.trade.credits -= pay;
  else if (trader) trader.credits += pay;
  if (trader) for (const l of check.get) takeStock(trader.stock, l.item, l.count);
  touchMarket(sim, trader);
  const deal: Deal = {
    id: sim.trade.nextId++, ship: offer.ship, give: check.give, get: check.get, barter: offer.barter, balance: offer.balance,
    held: Math.abs(pay), courier: plan.courier, phase: 'dispatch', vehicle: plan.vehicle, airlock: plan.airlock, timer: 0, tick: sim.tick,
  };
  const v = plan.vehicle ? sim.world.get(plan.vehicle, VehicleC) : undefined;
  if (v && deal.courier === 'you') v.autopilot = true;
  if (v && deal.give.length > 0) v.outbound = true;
  sim.trade.deals.push(deal);
  sim.trade.offers = sim.trade.offers.filter((o) => o.id !== offer.id);
  return deal;
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

/** Pay the escrow to the other side. The payer is the player when the balance is positive, else the trader. */
export function settleDeal(sim: Sim, d: Deal): void {
  const trader = sim.world.get(d.ship, TraderC);
  if (d.balance > 0 && !d.barter) {
    if (trader) trader.credits += d.held;
  } else if (d.balance < 0 && !d.barter) sim.trade.credits += d.held;
  const amount = d.barter ? 0 : d.balance;
  d.held = 0;
  d.phase = 'done';
  d.timer = 0;
  sim.events.emit({ type: 'trade.settled', deal: d.id, ship: d.ship, credits: amount });
  bumpStat(sim, 'trades');
  if (d.get.some((q) => q.item === FUEL_ITEM && q.count > 0)) bumpStat(sim, 'fuelBought');
  trimHistory(sim);
}

/**
 * End a deal that will not finish. The escrow goes back to the payer. Goods the trader set aside return to its stock unless
 * the shuttle already flew them (`lost`: shot down after the exchange; the payer is refunded but the goods are gone).
 */
export function failDeal(sim: Sim, d: Deal, reason: string, lost = false): void {
  const trader = sim.world.get(d.ship, TraderC);
  if (d.balance > 0 && !d.barter) sim.trade.credits += d.held;
  else if (d.balance < 0 && !d.barter && trader) trader.credits += d.held;
  if (trader && !lost) for (const l of d.get) addStock(trader.stock, l.item, l.count);
  touchMarket(sim, trader);
  d.held = 0;
  d.phase = 'failed';
  d.reason = reason;
  d.timer = 0;
  const v = d.vehicle ? sim.world.get(d.vehicle, VehicleC) : undefined;
  if (v) {
    v.outbound = false;
    v.autopilot = false;
  }
  sim.events.emit({ type: 'trade.failed', deal: d.id, ship: d.ship, reason });
  trimHistory(sim);
}

function trimHistory(sim: Sim): void {
  const done = sim.trade.deals.filter((d) => !isLive(d));
  for (const d of done.slice(0, Math.max(0, done.length - DEAL_HISTORY))) sim.trade.deals.splice(sim.trade.deals.indexOf(d), 1);
}
