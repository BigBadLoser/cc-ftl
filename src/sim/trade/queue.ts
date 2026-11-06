import { ShipC } from '../combat/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { planCourier } from './courier';
import { holdTrip, isLive, setPhase, trimHistory } from './deals';
import { playerItems } from './player';
import { TraderC, type Deal } from './types';

/**
 * Queued deals. An accepted deal with a partner that already has a running deal waits (phase `queued`, nothing held) and starts, in the order
 * agreed, when the earlier one has ended and the shuttle is free again. Escrow, stock and the shuttle are taken only then, so a queued deal
 * can be called off at no cost, and whatever changed meanwhile (a spent purse, a sold-out shelf, a partner that left) is met at the front.
 */

/** End a queued deal that never started: nothing was held, so nothing is returned. */
export function dropQueued(sim: Sim, d: Deal, reason: string): void {
  d.reason = reason;
  if (d.trip) d.trip.rest = [];
  setPhase(sim, d, 'failed');
  sim.events.emit({ type: 'trade.failed', deal: d.id, ship: d.ship, reason });
  trimHistory(sim);
}

/** Why the deal's first trip cannot start now, or '' (the trader has the goods, the player the items, both wallets the cash). */
function shortOf(sim: Sim, d: Deal): string {
  const trader = sim.world.get(d.ship, TraderC);
  if (!trader) return 'traderGone';
  for (const l of d.get) if ((trader.stock.find((s) => s.item === l.item)?.count ?? 0) < l.count) return 'theyLack';
  for (const l of d.give) if (playerItems(sim, l.item) < l.count) return 'noItems';
  const pays = d.barter ? 0 : d.balance;
  if (pays > sim.trade.credits) return 'noFunds';
  if (pays < 0 && -pays > trader.credits) return 'theyBroke';
  return '';
}

/** One tick of a queued deal: drop it if its partner is gone, else start it once it is at the front and the shuttle is free. */
export function stepQueued(sim: Sim, d: Deal): void {
  if (!sim.world.get(d.ship, TraderC) || !sim.world.has(d.ship, ShipC)) return dropQueued(sim, d, 'traderGone');
  if (sim.trade.deals.some((o) => o !== d && o.ship === d.ship && isLive(o) && (o.phase !== 'queued' || o.id < d.id))) return;
  if ((sim.tick + d.id) % 10 !== 0) return;
  const plan = planCourier(sim, d.ship, d.give, d.get);
  if ('error' in plan) {
    if (plan.error === 'noTrader' || plan.error === 'noShip' || plan.error === 'noCourier') dropQueued(sim, d, plan.error);
    return; // a busy shuttle or no free airlock: wait
  }
  const why = shortOf(sim, d);
  if (why) return dropQueued(sim, d, why);
  // The order was cut into trips for the shuttle that was meant to fly it: a smaller one cannot carry them.
  const trips = [{ give: d.give, get: d.get }, ...(d.trip?.rest ?? [])];
  if (trips.some((t) => Math.max(t.give.reduce((n, l) => n + l.count, 0), t.get.reduce((n, l) => n + l.count, 0)) > plan.cap)) return dropQueued(sim, d, 'noCourier');
  d.courier = plan.courier;
  d.vehicle = plan.vehicle;
  d.airlock = plan.airlock;
  setPhase(sim, d, 'dispatch');
  holdTrip(sim, d, sim.world.get(d.ship, TraderC));
  const v = plan.vehicle ? sim.world.get(plan.vehicle, VehicleC) : undefined;
  if (v && d.courier === 'you') v.autopilot = true;
  if (v && d.give.length > 0) v.outbound = true;
}
