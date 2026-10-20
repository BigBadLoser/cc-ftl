import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { quote, type Quote } from './pricing';
import { playerItems, playerRoom } from './player';
import { ensureTrader, hailVerdict } from './traders';
import type { Offer } from './types';

/** Merge duplicate items, drop nothing: returns null when a line is not a positive whole count of a known item. */
export function cleanLines(sim: Sim, lines: readonly ItemQty[]): ItemQty[] | null {
  const out: ItemQty[] = [];
  for (const l of lines) {
    if (!Number.isInteger(l.count) || l.count < 1 || !sim.content.items[l.item]) return null;
    const have = out.find((o) => o.item === l.item);
    if (have) have.count += l.count;
    else out.push({ item: l.item, count: l.count });
  }
  return out.sort((a, b) => (a.item < b.item ? -1 : a.item > b.item ? 1 : 0));
}

export const unitsOf = (lines: readonly ItemQty[]): number => lines.reduce((n, l) => n + l.count, 0);

export interface OfferCheck {
  /** Reject code, or null if the offer stands. */
  error: string | null;
  give: ItemQty[];
  get: ItemQty[];
  quote: Quote | null;
}

/**
 * Validate and price a proposal against the current state: the trader answers, every item has a price, the trader has what
 * it is asked for, the player has what they offer, a barter does not short the trader, and both purses cover their part.
 * Used by `trade.offer`, again by `trade.accept`, and by the UI snapshot for its live balance.
 */
export function checkOffer(sim: Sim, ship: number, giveIn: readonly ItemQty[], getIn: readonly ItemQty[], barter: boolean): OfferCheck {
  const give = cleanLines(sim, giveIn);
  const get = cleanLines(sim, getIn);
  const fail = (error: string, q: Quote | null = null): OfferCheck => ({ error, give: give ?? [], get: get ?? [], quote: q });
  if (!give || !get) return fail('badLine');
  const trader = ensureTrader(sim, ship);
  if (!trader) return fail('noTrader');
  const hail = sim.trade.hails.find((h) => h.ship === ship);
  if (!hail?.answered || !hailVerdict(sim, ship).answers) return fail('notAnswered');
  if (give.length + get.length === 0) return fail('empty');
  const q = quote(sim, ship, give, get);
  if (!q) return fail('noPrice');
  for (const l of get) if ((trader.stock.find((s) => s.item === l.item)?.count ?? 0) < l.count) return fail('theyLack', q);
  for (const l of give) if (playerItems(sim, l.item) < l.count) return fail('noItems', q);
  if (barter && q.balance > 0) return fail('unbalanced', q);
  const pays = barter ? 0 : q.balance;
  if (pays > sim.trade.credits) return fail('noFunds', q);
  if (pays < 0 && -pays > trader.credits) return fail('theyBroke', q);
  if (trader.station) {
    // Instant fallback: the goods are put straight into storage, so it must have room.
    for (const l of get) if (playerRoom(sim, l.item) < l.count) return fail('noRoom', q);
  }
  return { error: null, give, get, quote: q };
}

/** Credits that change hands: 0 for a barter, else the balance (> 0 the player pays, < 0 the trader pays). */
export const settlement = (o: Pick<Offer, 'barter' | 'balance'>): number => (o.barter ? 0 : o.balance);
