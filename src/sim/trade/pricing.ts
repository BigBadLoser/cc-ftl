import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { contrabandRate, isContraband, serviceFactor } from '../blackmarket/services';
import { reputationOf } from '../story/state';
import { isSurplus, repKeyOf } from './traders';
import { TraderC, type Trader } from './types';

/** How far scarcity moves a price (see `stockFactor`). */
export const MARKET_SWING = 0.6;
export const MARKET_REF = 20;
export const MARKET_CHEAP = 0.5;
export const MARKET_DEAR = 1.6;

export type PriceSide = 'sell' | 'buy';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Reputation points the player has with the trader's owner (its own faction's standing, not a shared key). */
export function reputationWith(sim: Sim, trader: number): number {
  const t = sim.world.get(trader, TraderC);
  const key = t && repKeyOf(sim, t);
  return key ? reputationOf(sim.story, key) : 0;
}

/**
 * Credits per unit between the trader and the player. 'sell' = the trader sells to the player, 'buy' = it buys from the player.
 * price = base x global spread x faction x trader kind x item-tag mods (x surplus markup) x reputation, rounded, at least 1. A buy price never
 * exceeds the sell price of the same item, so shuttling goods back and forth cannot make money. Null = not for sale / no trade.
 */
export function unitPrice(sim: Sim, trader: number, item: string, side: PriceSide): number | null {
  const cfg = sim.content.trade;
  const t = sim.world.get(trader, TraderC);
  const base = sim.content.items[item]?.price;
  if (!cfg || !t || base === undefined) return null;
  const rep = reputationWith(sim, trader);
  const level = stockFactor(t.stock.find((l) => l.item === item)?.count ?? 0, t.base?.find((l) => l.item === item)?.count);
  const contra = isContraband(sim, item);
  const rate = contrabandRate(sim, t);
  // A legitimate trader does not buy contraband; a black market pays a share of its value, a fence pays its rate for anything.
  if (contra && side === 'buy' && rate === null) return null;
  const raw = (s: PriceSide): number => {
    if (contra && s === 'buy') {
      const shift = clamp(cfg.repStep * rep, -cfg.repMax, cfg.repMax);
      return Math.max(1, Math.round(base * (rate ?? 0) * (1 + shift)), t.fence !== undefined ? Math.round(base * t.fence) : 0);
    }
    let p = applyMods(sim, t, item, s, base * (s === 'sell' ? cfg.spread.sell : cfg.spread.buy));
    p *= level;
    // A friend gets better prices: they sell for less and pay more.
    const shift = clamp(cfg.repStep * rep, -cfg.repMax, cfg.repMax);
    p *= s === 'sell' ? 1 - shift : 1 + shift;
    const fenced = s === 'buy' && t.fence !== undefined ? Math.round(base * t.fence) : 0;
    return Math.max(1, Math.round(p), fenced);
  };
  const sell = raw('sell');
  return side === 'sell' ? sell : Math.min(raw('buy'), sell);
}

/** The faction, trader kind, item-tag and surplus multipliers of a trader applied to a price. */
function applyMods(sim: Sim, t: Trader, item: string, s: PriceSide, price: number): number {
  const cfg = sim.content.trade;
  const kind = cfg?.traders[t.profile];
  let p = price * (cfg?.factions[t.faction]?.[s] ?? 1) * (kind?.[s] ?? 1);
  for (const tag of sim.content.items[item]?.tags ?? []) p *= kind?.tagMods?.[tag]?.[s] ?? 1;
  // What the owner faction sells cheaper (Meridian's fuel): by item id, else by tag.
  const perk = s === 'sell' && t.owner ? sim.content.galaxy?.factions[t.owner]?.specialities?.prices : undefined;
  if (perk) p *= perk[item] ?? (sim.content.items[item]?.tags ?? []).reduce((m, tag) => m * (perk[tag] ?? 1), 1);
  // A black-market service's own price mods.
  p *= serviceFactor(sim, t, item, s);
  // Surplus gear sells at the kind's markup.
  if (s === 'sell' && isSurplus(sim, t.profile, item)) p *= kind?.surplus?.markup ?? 1;
  return p;
}

/**
 * Scarcity in the price: 1 at the baseline, up to MARKET_DEAR when the port is out of a good and down to MARKET_CHEAP when it is swamped (a swing of
 * MARKET_SWING x the shortfall over max(baseline, MARKET_REF)). `base` undefined = not a tracked good: 1.
 */
export function stockFactor(stock: number, base: number | undefined): number {
  if (base === undefined) return 1;
  return clamp(1 + (MARKET_SWING * (base - stock)) / Math.max(base, MARKET_REF), MARKET_CHEAP, MARKET_DEAR);
}

/** What one unit of an item is worth at a trader of this kind, as a number (no spread, rounding or reputation): the mid price NPC traders compare stops by. */
export function marketValue(sim: Sim, t: Trader, item: string, stock: number, base: number | undefined): number {
  const p = sim.content.items[item]?.price;
  return p === undefined ? 0 : applyMods(sim, t, item, 'sell', p) * stockFactor(stock, base);
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
