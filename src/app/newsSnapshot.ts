import { galaxyIndex, newsFeed, type NewsItem, type Sim } from '../sim';
import type { UiNews } from '../ui/starmapApi';

/** The most items the feed shows. */
const SHOWN = 14;

const factionName = (sim: Sim, id: string | undefined): string => (id ? sim.content.galaxy?.factions[id]?.name ?? id : 'unknown');
const itemName = (sim: Sim, id: string | undefined): string => (id ? sim.content.items[id]?.name ?? id : 'goods');

/** A node's name when the player has charted it, else "uncharted space". */
function placeOf(sim: Sim, node: string): string {
  const n = galaxyIndex(sim.galaxy).nodes.get(node);
  return n && sim.galaxy.discovered[node] !== undefined ? n.name : 'uncharted space';
}

/** The sector of a node by name ("far off" when none of it has been charted): rumours only say roughly where. */
function regionOf(sim: Sim, node: string): string {
  const index = galaxyIndex(sim.galaxy);
  const sector = index.sectors.get(index.nodes.get(node)?.sector ?? '');
  return sector && sector.nodes.some((id) => sim.galaxy.discovered[id] !== undefined) ? sector.name : 'far off';
}

const LOOK: Record<NewsItem['kind'], Pick<UiNews, 'icon' | 'tone'>> = {
  destroyed: { icon: 'skull', tone: 'red' }, raid: { icon: 'skull', tone: 'red' }, driven: { icon: 'evasion', tone: 'amber' }, clash: { icon: 'combat', tone: 'amber' },
  cut: { icon: 'trade', tone: 'amber' }, loot: { icon: 'stock', tone: 'amber' }, shortage: { icon: 'stock', tone: 'dim' }, rebuilt: { icon: 'ship', tone: 'green' },
};

/** What happened, with names: for news the player's sensors cover. */
function precise(sim: Sim, n: NewsItem): string {
  const foe = n.foe ?? 'a ship';
  switch (n.kind) {
    case 'destroyed': return `${n.who} destroyed ${foe}`;
    case 'raid': return `${n.who} raided a pirate den and destroyed ${foe}`;
    case 'driven': return `${n.who} drove off ${foe}`;
    case 'clash': return `${n.who} and ${foe} fought to a standstill`;
    case 'cut': return `Trade route cut: ${n.who} was lost`;
    case 'loot': return `${n.who} took ${n.count ?? 0} ${itemName(sim, n.item)} from ${foe}`;
    case 'shortage': return `${placeOf(sim, n.node)} is short of ${itemName(sim, n.item)}`;
    case 'rebuilt': return `${n.who} was launched from ${placeOf(sim, n.node)}`;
  }
}

/** The same, as heard from far off: no ship names, only factions and the region. */
function rumour(sim: Sim, n: NewsItem): string {
  const here = regionOf(sim, n.node);
  const a = factionName(sim, n.faction);
  const b = factionName(sim, n.foeFaction);
  switch (n.kind) {
    case 'destroyed': case 'driven': case 'clash': case 'raid': return `${a} and ${b} ships fought near ${here}`;
    case 'cut': return `Merchants are losing ships near ${here}`;
    case 'loot': return `Cargo was taken off a ${b} ship near ${here}`;
    case 'shortage': return `${itemName(sim, n.item)} is short somewhere near ${here}`;
    case 'rebuilt': return `${a} launched a ship near ${here}`;
  }
}

/** The news feed for the starmap: newest first, precise inside sensor range, a rumour outside it. */
export function newsOf(sim: Sim): UiNews[] {
  return newsFeed(sim).slice(0, SHOWN).map(({ item, precise: near }) => ({
    id: item.id, turn: item.turn, ...LOOK[item.kind], text: near ? precise(sim, item) : rumour(sim, item),
    place: near ? placeOf(sim, item.node) : regionOf(sim, item.node), rumour: !near,
  }));
}
