import { dockPort, econOf, factorAt, portsAt, stockAt, type Fleet, type Sim } from '../sim';
import type { UiStarMarket } from '../ui/starmapApi';

/** A good counts as cheap below this price factor and as dear above that one. */
const CHEAP = 0.85;
const DEAR = 1.15;
/** How many goods the market line names on each side. */
const SHOWN = 2;

/** The market of the node's trading port as a short line (its cheapest and dearest goods), or null when the node has none. */
export function marketOf(sim: Sim, node: string): UiStarMarket | null {
  const port = dockPort(portsAt(sim, node), 'trader');
  const e = port && econOf(sim, port);
  if (!e) return null;
  const stock = stockAt(sim, e, sim.galaxy.turn);
  const rows = (sim.content.galaxy?.market.goods ?? []).map((item) => ({ name: sim.content.items[item]?.name ?? item, f: factorAt(e, item, stock[item] ?? 0) }));
  const name = (r: { name: string }): string => r.name;
  return {
    cheap: rows.filter((r) => r.f <= CHEAP).sort((a, b) => a.f - b.f || (a.name < b.name ? -1 : 1)).slice(0, SHOWN).map(name),
    dear: rows.filter((r) => r.f >= DEAR).sort((a, b) => b.f - a.f || (a.name < b.name ? -1 : 1)).slice(0, SHOWN).map(name),
  };
}

/** What a fleet carries, as "12 Metal, 4 Ice" ('' when empty). */
export function cargoOf(sim: Sim, f: Fleet): string {
  return (f.cargo ?? []).map((l) => `${l.count} ${sim.content.items[l.item]?.name ?? l.item}`).join(', ');
}
