import type { UiTradeLine, UiTradePartner } from './api';

/** The trade window's draft: a signed amount per item id. Positive buys from the partner, negative sells to them. */
export type Draft = Record<string, number>;

export interface DraftLine { item: string; name: string; count: number; value: number }
export interface DraftSummary {
  buy: DraftLine[];
  sell: DraftLine[];
  /** Credits the player pays (> 0) or is paid (< 0), before any shuttle cost. */
  balance: number;
  buyUnits: number;
  sellUnits: number;
}

/** How much one click moves: 1, Shift 5, Ctrl 10. */
export function stepOf(e: { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }): number {
  return e.ctrlKey || e.metaKey ? 10 : e.shiftKey ? 5 : 1;
}

/** Can the player sell this line here? Contraband sells only to a black market. */
export const sellable = (l: UiTradeLine, p: Pick<UiTradePartner, 'market'>): boolean => l.mine > 0 && (!l.contraband || !!p.market);

const valueOf = (lines: readonly UiTradeLine[], draft: Draft, skip: string, side: 'buy' | 'sell'): number =>
  lines.reduce((n, l) => {
    const q = draft[l.item] ?? 0;
    if (l.item === skip || (side === 'buy' ? q <= 0 : q >= 0)) return n;
    return n + Math.abs(q) * (side === 'buy' ? l.sell : l.buy);
  }, 0);

/**
 * The most that can be bought (`up`, a positive count) and sold (`down`, a positive count) of one line given the rest of the draft:
 * what the partner has in stock and the player holds (free of promises to queued deals), what the player's credits cover once the other
 * lines' sales are counted in, and what the partner's purse can pay once their other purchases are.
 */
export function limits(l: UiTradeLine, p: UiTradePartner, draft: Draft, credits: number): { up: number; down: number } {
  const lines = p.lines;
  const buys = valueOf(lines, draft, l.item, 'buy');
  const sells = valueOf(lines, draft, l.item, 'sell');
  const byStock = l.theirsFree ?? l.theirs;
  const byCash = l.sell > 0 ? Math.floor(Math.max(0, credits + sells - buys) / l.sell) : byStock;
  const byHold = sellable(l, p) ? (l.mineFree ?? l.mine) : 0;
  const byPurse = l.buy > 0 ? Math.floor(Math.max(0, (p.walletFree ?? p.wallet) + buys - sells) / l.buy) : byHold;
  return { up: Math.max(0, Math.min(byStock, byCash)), down: Math.max(0, Math.min(byHold, byPurse)) };
}

/** Clamp a wanted signed amount to what the limits allow. */
export function clampQty(want: number, lim: { up: number; down: number }): number {
  if (!Number.isFinite(want)) return 0;
  const n = Math.trunc(want);
  return n >= 0 ? Math.min(n, lim.up) : -Math.min(-n, lim.down);
}

export function summarize(lines: readonly UiTradeLine[], draft: Draft): DraftSummary {
  const buy: DraftLine[] = [];
  const sell: DraftLine[] = [];
  for (const l of lines) {
    const q = draft[l.item] ?? 0;
    if (q > 0) buy.push({ item: l.item, name: l.name, count: q, value: q * l.sell });
    else if (q < 0) sell.push({ item: l.item, name: l.name, count: -q, value: -q * l.buy });
  }
  const sum = (a: DraftLine[]) => a.reduce((n, x) => n + x.value, 0);
  const units = (a: DraftLine[]) => a.reduce((n, x) => n + x.count, 0);
  return { buy, sell, balance: sum(buy) - sum(sell), buyUnits: units(buy), sellUnits: units(sell) };
}

/** Shuttle trips an order takes on a hold of `cap` units (a trip carries up to `cap` each way). */
export const tripsFor = (s: Pick<DraftSummary, 'buyUnits' | 'sellUnits'>, cap: number): number =>
  cap > 0 ? Math.max(1, Math.ceil(Math.max(s.buyUnits, s.sellUnits) / cap)) : 1;
