import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { linesValue } from './pricing';
import { playerItems } from './player';
import { TraderC, type Trip } from './types';

/** An order may take at most this many haul trips (a sanity bound; beyond it the order is refused as too big). */
export const MAX_TRIPS = 8;

/** Units `k*cap .. (k+1)*cap` of the lines, taken in their order: one trip's share of one side of an order. */
function slice(lines: readonly ItemQty[], cap: number, k: number): ItemQty[] {
  const out: ItemQty[] = [];
  let at = 0;
  const lo = k * cap;
  const hi = lo + cap;
  for (const l of lines) {
    const n = Math.min(at + l.count, hi) - Math.max(at, lo);
    if (n > 0) out.push({ item: l.item, count: n });
    at += l.count;
  }
  return out;
}

/** How many trips an order of these lines needs on a hold of `cap` units (a trip carries up to `cap` units each way). */
export function tripCount(give: readonly ItemQty[], get: readonly ItemQty[], cap: number): number {
  const units = Math.max(give.reduce((n, l) => n + l.count, 0), get.reduce((n, l) => n + l.count, 0));
  return cap > 0 ? Math.max(1, Math.ceil(units / cap)) : Infinity;
}

/**
 * Split an order into haul trips of at most `cap` units each way. Each trip is priced now, at the order's prices, so the trips'
 * balances add up to the order's balance whatever the stock does later. Null if an item has no price.
 */
export function planTrips(sim: Sim, ship: number, give: readonly ItemQty[], get: readonly ItemQty[], cap: number): Trip[] | null {
  const n = tripCount(give, get, cap);
  const trips: Trip[] = [];
  for (let k = 0; k < n; k++) {
    const g = slice(give, cap, k);
    const r = slice(get, cap, k);
    const gv = linesValue(sim, ship, g, 'buy');
    const rv = linesValue(sim, ship, r, 'sell');
    if (gv === null || rv === null) return null;
    trips.push({ give: g, get: r, balance: rv - gv });
  }
  return trips;
}

/** Whether the next trip of a running order can start now: the trader still has the goods, the player the items and both wallets the cash. */
export function canStart(sim: Sim, ship: number, t: Trip, barter: boolean): boolean {
  const trader = sim.world.get(ship, TraderC);
  if (!trader) return false;
  for (const l of t.get) if ((trader.stock.find((s) => s.item === l.item)?.count ?? 0) < l.count) return false;
  for (const l of t.give) if (playerItems(sim, l.item) < l.count) return false;
  const pays = barter ? 0 : t.balance;
  return pays <= sim.trade.credits && (pays >= 0 || -pays <= trader.credits);
}
