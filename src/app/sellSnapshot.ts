import { REACH_HOPS } from '../sim/galaxy/tuning';
import { econOf, nodeOf, nodesWithin, playerItems, portsAt, quoteAt, sensorNodes, stockAt, type Sim } from '../sim';
import type { UiSellGood } from '../ui/starmapApi';

/** How many ports each good lists. */
const BEST = 3;

/**
 * Where the goods aboard sell best (issue #222): for every good of the galaxy market the player holds, the known ports in sensor range and
 * within reach that pay most for it now, dearest first, with the jumps to get there. Built on demand (the starmap's Sell panel).
 */
export function whereToSell(sim: Sim): UiSellGood[] {
  const g = sim.galaxy;
  const goods = (sim.content.galaxy?.market.goods ?? []).filter((item) => playerItems(sim, item) > 0);
  if (!goods.length) return [];
  const sensors = sensorNodes(sim);
  const reach = nodesWithin(sim, g.current, REACH_HOPS);
  const ports: { node: string; name: string; hops: number; quote: (item: string) => number | null }[] = [];
  for (const [node, hops] of reach) {
    if (g.discovered[node] === undefined || !sensors.has(node)) continue;
    for (const port of portsAt(sim, node)) {
      const e = econOf(sim, port);
      if (!e) continue;
      const stock = stockAt(sim, e, g.turn);
      ports.push({ node, name: nodeOf(sim, node)?.name ?? node, hops, quote: (item) => quoteAt(sim, e, item, stock[item] ?? 0, 'buy') });
    }
  }
  return goods.map((item) => {
    const best = ports.map((p) => ({ node: p.node, name: p.name, hops: p.hops, price: p.quote(item) ?? 0 }))
      .filter((p) => p.price > 0)
      .sort((a, b) => b.price - a.price || a.hops - b.hops || (a.name < b.name ? -1 : 1));
    // One row per node (a node's best port), then the top few.
    const seen = new Set<string>();
    const rows = best.filter((p) => !seen.has(p.node) && !!seen.add(p.node)).slice(0, BEST);
    return { item, name: sim.content.items[item]?.name ?? item, count: playerItems(sim, item), best: rows };
  }).sort((a, b) => (b.best[0]?.price ?? 0) * b.count - (a.best[0]?.price ?? 0) * a.count);
}
