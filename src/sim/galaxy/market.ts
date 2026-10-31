import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import { marketQuote, marketValue, stockFactor, type PriceSide } from '../trade/pricing';
import { rollTrader } from '../trade/traders';
import { TraderC, type Trader } from '../trade/types';
import { strHash, unit } from './hash';
import type { Port } from './ports';
import { nodeOf } from './state';
import { MARKET_CAP_MIN, MARKET_CAP_MULT, MARKET_DRIFT, MARKET_EPS, MARKET_START_SPREAD, MARKET_WANT_TURNS } from './tuning';
import type { MarketState } from './types';

/**
 * The NPC economy in one place. A port's market is a trade profile's stock (the baseline: what `rollTrader` gives that port) that the port produces from
 * and consumes into every turn. Per item, with b = baseline, net = (production - consumption) x port size per turn and D = MARKET_DRIFT:
 *     level = b + net / D        stock(n turns later) = level + (stock - level) x (1 - D)^n        clamped to [0, cap]
 * the closed form of "move the fraction D of the way to the level each turn" (the clamp never bites mid-way: the stock moves monotonically toward the level, so
 * clamping at the end equals clamping every turn). So catching a market up over any number of turns is one step, and an untouched port is its baseline at
 * turn 0 and matured by the time anyone looks. Trades are impulses (`moveStock`); the price follows the stock (`trade/pricing.ts` `stockFactor`).
 *
 * One source of truth per port: in the player's live node the station's `TraderC` holds the stock (marketLive.ts); anywhere else `GalaxyState.markets`
 * does, as the items that differ from the baseline plus the turn they are as of.
 */
export interface Econ {
  id: string;
  profile: string;
  /** A trader record carrying the profile and faction, for pricing. */
  trader: Trader;
  /** Baseline by item: the profile's rolled stock, the commodities at 0, and at least MARKET_WANT_TURNS of consumption of what the port eats. */
  base: Record<string, number>;
  /** Net units per turn (production - consumption, x size). */
  net: Record<string, number>;
  /** Every item the port keeps a level for, ascending. */
  items: string[];
  /**
   * Where each level starts before any trade (issue #222): the baseline shifted by MARKET_START_SPREAD either way, rolled per port and good
   * from the galaxy seed, so prices differ between ports from the first turn instead of all sitting at the baseline.
   */
  start: Record<string, number>;
}

/** The trade profile a port's market is, or null (no market). */
export function profileOf(sim: Sim, port: Port): string | null {
  const m = sim.content.galaxy?.market;
  const p = m?.profiles[port.kind];
  if (!m || !p) return null;
  const node = nodeOf(sim, port.node);
  const def = node && sim.content.galaxy?.structures[node.structures[Number(port.id.slice(port.id.indexOf('#') + 1))]?.def ?? ''];
  if (port.kind === 'station' && def?.station === 'research' && m.research && sim.content.trade?.traders[m.research]) return m.research;
  const pick = port.kind === 'station' && unit(sim.seed, strHash(port.id), 73) < m.farm.chance ? m.farm.profile : p;
  return sim.content.trade?.traders[pick] ? pick : null;
}

/** Derived once per port and kept (pure of the seed and content, never saved). */
const cache = new WeakMap<Sim, Map<string, Econ | null>>();

/** The port's economy, or null when it has no market. */
export function econOf(sim: Sim, port: Port): Econ | null {
  let byPort = cache.get(sim);
  if (!byPort) cache.set(sim, (byPort = new Map()));
  if (byPort.has(port.id)) return byPort.get(port.id) as Econ | null;
  const made = build(sim, port);
  byPort.set(port.id, made);
  return made;
}

function build(sim: Sim, port: Port): Econ | null {
  const profile = profileOf(sim, port);
  const m = sim.content.galaxy?.market;
  if (!profile || !m) return null;
  const faction = sim.content.trade?.traders[profile]?.match.faction ?? profile;
  const base: Record<string, number> = {};
  for (const g of m.goods) base[g] = 0;
  for (const l of rollTrader(sim, profile, faction, port.id, strHash(port.id), true, port.owner).stock) base[l.item] = l.count;
  const net: Record<string, number> = {};
  const rates = m.rates[profile];
  for (const [item, r] of Object.entries(rates?.produce ?? {})) net[item] = (net[item] ?? 0) + r * port.size;
  for (const [item, r] of Object.entries(rates?.consume ?? {})) {
    net[item] = (net[item] ?? 0) - r * port.size;
    base[item] = Math.max(base[item] ?? 0, Math.round(MARKET_WANT_TURNS * r * port.size));
  }
  const items = [...new Set([...Object.keys(base), ...Object.keys(net)])].sort();
  const start: Record<string, number> = {};
  for (const item of items) {
    const b = base[item] ?? 0;
    start[item] = b > 0 ? Math.round(b * (1 + MARKET_START_SPREAD * (2 * unit(sim.seed, strHash(`${port.id}|${item}`), 211) - 1))) : b;
  }
  return { id: port.id, profile, trader: { profile, faction, name: port.id, credits: 0, stock: [], station: true, owner: port.owner }, base, net, items, start };
}

/** The most of an item the port holds. */
export const capOf = (base: number): number => Math.max(MARKET_CAP_MIN, base * MARKET_CAP_MULT);

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** x^n for integer n by repeated multiplication (exact in IEEE arithmetic, unlike Math.pow, which engines may round differently). */
function powInt(x: number, n: number): number {
  let r = 1;
  let b = x;
  for (let k = n; k > 0; k >>= 1) {
    if (k & 1) r *= b;
    b *= b;
  }
  return r;
}

/** Every stock level of the market as of turn `to` (not earlier than the state's own turn), from the state's items on top of the baseline. */
export function advance(e: Econ, st: MarketState, to: number): Record<string, number> {
  const n = Math.max(0, to - st.turn);
  const keep = powInt(1 - MARKET_DRIFT, n);
  const out: Record<string, number> = {};
  for (const item of e.items) out[item] = level(e, st, item, n, keep);
  for (const item of Object.keys(st.stock)) if (!(item in out)) out[item] = level(e, st, item, n, keep);
  return out;
}

function level(e: Econ, st: MarketState, item: string, n: number, keep: number): number {
  const b = e.base[item] ?? 0;
  const s0 = st.stock[item] ?? e.start[item] ?? b;
  if (n === 0) return s0;
  const eq = b + (e.net[item] ?? 0) / MARKET_DRIFT;
  return clamp(eq + (s0 - eq) * keep, 0, capOf(b));
}

/** The state that stores `full` as of `turn`: only the items off their starting level (`Econ.start`), to two decimals. */
export function toState(e: Econ, full: Readonly<Record<string, number>>, turn: number): MarketState {
  const stock: Record<string, number> = {};
  for (const [item, v] of Object.entries(full)) {
    const r = Math.round(v * 100) / 100;
    if (Math.abs(r - (e.start[item] ?? e.base[item] ?? 0)) >= MARKET_EPS) stock[item] = r;
  }
  return { turn, stock };
}

/** The entity of the live station that is this port's market, or undefined (the port is not in the player's node, or no station stands for it). */
export function liveTrader(sim: Sim, portId: string): number | undefined {
  if (sim.galaxy.current !== portId.slice(0, portId.indexOf('#'))) return undefined;
  return sim.world.query(TraderC).find((id) => sim.world.get(id, TraderC)?.port === portId);
}

/** The market's stock as of turn `at`: the live station's, or the galaxy state caught up (read only). */
export function stockAt(sim: Sim, e: Econ, at: number): Record<string, number> {
  const live = liveTrader(sim, e.id);
  if (live !== undefined) {
    const out: Record<string, number> = {};
    for (const l of sim.world.get(live, TraderC)?.stock ?? []) out[l.item] = l.count;
    return out;
  }
  return advance(e, sim.galaxy.markets[e.id] ?? { turn: 0, stock: {} }, at);
}

/** The port's price for one unit on a side with this much on the shelf (what the player pays, 'sell', or is paid, 'buy'), or null. */
export const quoteAt = (sim: Sim, e: Econ, item: string, stock: number, side: PriceSide): number | null => marketQuote(sim, e.trader, item, stock, e.base[item], side);

/** What one unit is worth at the port with this much on the shelf. */
export const valueAt = (sim: Sim, e: Econ, item: string, stock: number): number => marketValue(sim, e.trader, item, stock, e.base[item]);

/** The price factor of an item at the port (1 = at its baseline), for display. */
export const factorAt = (e: Econ, item: string, stock: number): number => stockFactor(stock, e.base[item]);

/**
 * Add (`delta` > 0) or take (< 0) units of an item at the port's market as of turn `at`; returns the units that actually moved (same sign): a shelf cannot go
 * below 0 or above its cap (what does not fit is not taken). The live station's stock is changed in place; otherwise the state is caught up and stored.
 */
export function moveStock(sim: Sim, e: Econ, at: number, item: string, delta: number): number {
  const cap = capOf(e.base[item] ?? 0);
  const live = liveTrader(sim, e.id);
  if (live !== undefined) {
    const t = sim.world.get(live, TraderC) as Trader;
    const line = t.stock.find((l) => l.item === item);
    const have = line?.count ?? 0;
    const next = Math.floor(clamp(have + delta, 0, Math.max(cap, have)));
    if (line) line.count = next;
    else if (next > 0) t.stock.push({ item, count: next });
    t.stock = t.stock.filter((l) => l.count > 0);
    return next - have;
  }
  const full = stockAt(sim, e, at);
  const have = full[item] ?? 0;
  const next = clamp(have + delta, 0, Math.max(cap, have));
  full[item] = next;
  const turn = Math.max(at, sim.galaxy.markets[e.id]?.turn ?? 0);
  sim.galaxy.markets[e.id] = toState(e, full, turn);
  return next - have;
}

/** Baseline as trade-record lines (zeros included), for a live station's `Trader.base`. */
export const baseLines = (e: Econ): ItemQty[] => Object.entries(e.base).sort(([a], [b]) => (a < b ? -1 : 1)).map(([item, count]) => ({ item, count }));
