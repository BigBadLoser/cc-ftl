import { dockPort, econOf, factorAt, portsAt, quoteAt, stockAt, type Fleet, type Port, type Sim } from '../sim';
import type { UiGoodPrice, UiStarMarket } from '../ui/starmapApi';
import type { UiStationInfo } from '../ui/api';

/** A good counts as cheap below this price factor and as dear above that one. */
const CHEAP = 0.85;
const DEAR = 1.15;
/** How many goods the market line names on each side. */
const SHOWN = 2;

/** The market of the node's trading port as a short line (its cheapest and dearest goods), or null when the node has none. */
export function marketOf(sim: Sim, node: string): UiStarMarket | null {
  const port = dockPort(portsAt(sim, node), 'trader');
  return port ? marketAt(sim, port) : null;
}

/**
 * The market of one port as a short line, or null when it does not trade: its cheapest goods with what it sells them for, and its dearest
 * with what it pays for them (issue #222: numbers, not just names).
 */
export function marketAt(sim: Sim, port: Port): UiStarMarket | null {
  const e = econOf(sim, port);
  if (!e) return null;
  const stock = stockAt(sim, e, sim.galaxy.turn);
  const rows = (sim.content.galaxy?.market.goods ?? []).map((item) => ({ item, name: sim.content.items[item]?.name ?? item, f: factorAt(e, item, stock[item] ?? 0) }));
  const priced = (side: 'sell' | 'buy') => (r: { item: string; name: string }): UiGoodPrice => ({ name: r.name, price: quoteAt(sim, e, r.item, stock[r.item] ?? 0, side) ?? 0 });
  return {
    cheap: rows.filter((r) => r.f <= CHEAP).sort((a, b) => a.f - b.f || (a.name < b.name ? -1 : 1)).slice(0, SHOWN).map(priced('sell')),
    dear: rows.filter((r) => r.f >= DEAR).sort((a, b) => b.f - a.f || (a.name < b.name ? -1 : 1)).slice(0, SHOWN).map(priced('buy')),
  };
}

/** One port's price list for the station inspector: every good it keeps a stock of, both prices, cheap or dear tone. */
export function pricesAt(sim: Sim, port: Port): UiStationInfo['prices'] {
  const e = econOf(sim, port);
  if (!e) return [];
  const stock = stockAt(sim, e, sim.galaxy.turn);
  return (sim.content.galaxy?.market.goods ?? []).filter((item) => (e.base[item] ?? 0) > 0).map((item) => {
    const n = stock[item] ?? 0;
    const f = factorAt(e, item, n);
    return {
      name: sim.content.items[item]?.name ?? item, buy: quoteAt(sim, e, item, n, 'buy') ?? 0, sell: quoteAt(sim, e, item, n, 'sell') ?? 0,
      tone: f <= CHEAP ? 'cheap' as const : f >= DEAR ? 'dear' as const : '' as const,
    };
  }).sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** What a fleet carries, as "12 Metal, 4 Ice" ('' when empty). */
export function cargoOf(sim: Sim, f: Fleet): string {
  return (f.cargo ?? []).map((l) => `${l.count} ${sim.content.items[l.item]?.name ?? l.item}`).join(', ');
}
