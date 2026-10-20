import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import { TraderC } from './types';

export type PriceSide = 'sell' | 'buy';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Reputation points the player has with the trader's faction. */
export function reputationWith(sim: Sim, trader: number): number {
  const t = sim.world.get(trader, TraderC);
  const key = t && sim.content.trade?.factions[t.faction]?.reputation;
  return key ? reputationOf(sim.story, key) : 0;
}

/**
 * Credits per unit between the trader and the player. 'sell' = the trader sells to the player, 'buy' = it buys from the player.
 * price = base x global spread x faction x trader kind x item-tag mods x reputation, rounded, at least 1. A buy price never
 * exceeds the sell price of the same item, so shuttling goods back and forth cannot make money. Null = not for sale / no trade.
 */
export function unitPrice(sim: Sim, trader: number, item: string, side: PriceSide): number | null {
  const cfg = sim.content.trade;
  const t = sim.world.get(trader, TraderC);
  const base = sim.content.items[item]?.price;
  if (!cfg || !t || base === undefined) return null;
  const kind = cfg.traders[t.profile];
  const fac = cfg.factions[t.faction];
  const rep = reputationWith(sim, trader);
  const raw = (s: PriceSide): number => {
    let p = base * (s === 'sell' ? cfg.spread.sell : cfg.spread.buy) * (fac?.[s] ?? 1) * (kind?.[s] ?? 1);
    for (const tag of sim.content.items[item]?.tags ?? []) p *= kind?.tagMods?.[tag]?.[s] ?? 1;
    // A friend gets better prices: they sell for less and pay more.
    const shift = clamp(cfg.repStep * rep, -cfg.repMax, cfg.repMax);
    p *= s === 'sell' ? 1 - shift : 1 + shift;
    return Math.max(1, Math.round(p));
  };
  const sell = raw('sell');
  return side === 'sell' ? sell : Math.min(raw('buy'), sell);
}

/** Total credits of item lines at the trader's price on one side, or null if any line has no price. */
export function linesValue(sim: Sim, trader: number, lines: readonly ItemQty[], side: PriceSide): number | null {
  let total = 0;
  for (const l of lines) {
    const p = unitPrice(sim, trader, l.item, side);
    if (p === null) return null;
    total += p * l.count;
  }
  return total;
}

export interface Quote {
  /** What the player receives / hands over, in credits at the trader's prices. */
  getValue: number;
  giveValue: number;
  /** getValue - giveValue: > 0 the player pays the difference, < 0 the trader pays it, 0 = an even barter. */
  balance: number;
}

/** Price an exchange of lines; null if any item has no price. */
export function quote(sim: Sim, trader: number, give: readonly ItemQty[], get: readonly ItemQty[]): Quote | null {
  const getValue = linesValue(sim, trader, get, 'sell');
  const giveValue = linesValue(sim, trader, give, 'buy');
  if (getValue === null || giveValue === null) return null;
  return { getValue, giveValue, balance: getValue - giveValue };
}
