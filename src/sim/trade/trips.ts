import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { linesValue, unitPrice } from './pricing';
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

/** Credits per unit of a line, on the side it is priced at (the trader buys what the player gives, sells what the player gets). */
const unit = (sim: Sim, ship: number, item: string, side: 'buy' | 'sell'): number => unitPrice(sim, ship, item, side) ?? 0;

/**
 * Split an order into haul trips of at most `cap` units each way. Each trip is priced now, at the order's prices, so the trips'
 * balances add up to the order's balance whatever the stock does later. Null if an item has no price (or a barter cannot be laid out);
 * 'tooBig' if it would take more than MAX_TRIPS trips.
 *
 * A cash order is cut by units, side by side: every trip settles its own balance in credits, so stopping after any trip leaves the
 * player exactly even.
 * A barter moves no credits, so the player must never hold more than they have handed over. It is laid out player-first: each trip
 * carries the next `cap` units of the player's goods (dearest first), and the trader's goods (cheapest first) go out only as far as
 * what the player has handed over so far covers. Whatever is left after the player's side runs out follows in trips of its own.
 * At every settled point the goods received are worth no more than the goods given.
 */
export function planTrips(sim: Sim, ship: number, give: readonly ItemQty[], get: readonly ItemQty[], cap: number, barter = false): Trip[] | 'tooBig' | null {
  if (!barter) return tripCount(give, get, cap) > MAX_TRIPS ? 'tooBig' : cutByUnits(sim, ship, give, get, cap);
  const g = give.map((l) => ({ ...l })).sort((a, b) => unit(sim, ship, b.item, 'buy') - unit(sim, ship, a.item, 'buy') || (a.item < b.item ? -1 : 1));
  const r = get.map((l) => ({ ...l })).sort((a, b) => unit(sim, ship, a.item, 'sell') - unit(sim, ship, b.item, 'sell') || (a.item < b.item ? -1 : 1));
  const trips: Trip[] = [];
  let given = 0;
  let got = 0;
  while (g.some((l) => l.count > 0) || r.some((l) => l.count > 0)) {
    if (trips.length >= MAX_TRIPS) return 'tooBig';
    const tg = take(g, cap, () => Infinity, (l) => unit(sim, ship, l.item, 'buy'));
    given += tg.value;
    const tr = take(r, cap, (l) => Math.floor((given - got) / Math.max(1, unit(sim, ship, l.item, 'sell'))), (l) => unit(sim, ship, l.item, 'sell'));
    got += tr.value;
    if (tg.lines.length === 0 && tr.lines.length === 0) return null; // the rest cannot be paid for: not a balanced barter
    trips.push({ give: tg.lines, get: tr.lines, balance: tr.value - tg.value });
  }
  return trips.length > MAX_TRIPS ? 'tooBig' : trips;
}

/** Take up to `cap` units from the front of `lines` (mutating them), each line at most `room(line)` units. */
function take(lines: ItemQty[], cap: number, room: (l: ItemQty) => number, price: (l: ItemQty) => number): { lines: ItemQty[]; value: number } {
  const out: ItemQty[] = [];
  let value = 0;
  let left = cap;
  for (const l of lines) {
    const n = Math.min(l.count, left, room(l));
    if (n <= 0) continue;
    l.count -= n;
    left -= n;
    value += n * price(l);
    out.push({ item: l.item, count: n });
  }
  return { lines: out, value };
}

function cutByUnits(sim: Sim, ship: number, give: readonly ItemQty[], get: readonly ItemQty[], cap: number): Trip[] | null {
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

/**
 * The most each wallet must be able to fund while the order runs: settled trips move credits both ways, so it is the peak of the
 * running total of the trips' balances. `player` is the highest the player has paid out at any point, `trader` the highest the trader has.
 * A barter moves no credits.
 */
export function peakFunding(trips: readonly Trip[], barter: boolean): { player: number; trader: number } {
  let run = 0;
  let player = 0;
  let trader = 0;
  for (const t of trips) {
    if (!barter) run += t.balance;
    player = Math.max(player, run);
    trader = Math.max(trader, -run);
  }
  return { player, trader };
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
