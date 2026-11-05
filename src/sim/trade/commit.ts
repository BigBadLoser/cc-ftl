import type { Sim } from '../sim';
import { peakFunding } from './trips';
import type { Deal, Trip } from './types';

/**
 * What the player's running deals have already promised but not yet taken out of the wallets and holds: the trips that wait (a queued deal's
 * whole order, a running order's later trips) and the goods an early-phase deal has still to load. A new proposal is checked against what is
 * left, so queued deals never double-spend credits, double-sell a trader's stock or promise the same goods twice.
 */
export interface Commitments {
  /** Credits the player must still be able to pay out (the peak of each waiting order, summed). */
  credits: number;
  /** Credits each trader (by ship id) must still be able to pay. */
  theirs: Map<number, number>;
  /** Goods promised out of a trader's stock, keyed `ship:item`. */
  stock: Map<string, number>;
  /** Goods promised out of the player's holds, keyed by item. */
  items: Map<string, number>;
}

const add = <K>(m: Map<K, number>, k: K, n: number): void => void m.set(k, (m.get(k) ?? 0) + n);

/** Trips of a deal that nothing is held for yet. */
function waiting(d: Deal): Trip[] {
  const head: Trip = { give: d.give, get: d.get, balance: d.balance };
  return d.phase === 'queued' ? [head, ...(d.trip?.rest ?? [])] : (d.trip?.rest ?? []);
}

export function commitments(sim: Sim): Commitments {
  const c: Commitments = { credits: 0, theirs: new Map(), stock: new Map(), items: new Map() };
  for (const d of sim.trade.deals) {
    if (d.phase === 'done' || d.phase === 'failed' || d.crew || d.handover) continue;
    const trips = waiting(d);
    for (const t of trips) {
      for (const l of t.give) add(c.items, l.item, l.count);
      for (const l of t.get) add(c.stock, `${d.ship}:${l.item}`, l.count);
    }
    // The running trip's own goods are still in the holds until the shuttle has loaded them.
    if (d.phase === 'dispatch' || d.phase === 'load') for (const l of d.give) add(c.items, l.item, l.count);
    const peak = peakFunding(trips, d.barter);
    c.credits += peak.player;
    if (peak.trader > 0) add(c.theirs, d.ship, peak.trader);
  }
  return c;
}
