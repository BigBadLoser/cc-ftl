import type { Sim } from '../sim';
import { nodesWithin } from './graph';
import { SENSOR_HOPS } from './tuning';
import { NEWS_MAX, NEWS_SHORTAGE_TURNS } from './tuningWar';
import type { NewsItem } from './types';

/**
 * The news log (living world stage 4): a bounded record of what the world did while the player was elsewhere - battles, losses, wrecks, a den raided, a trade
 * route cut, a port short of goods, a ship launched. Only the sim writes it (`report`); the view reads `newsFeed`, which says which items fall inside the
 * player's sensor range (precise: names and places) and which are only heard of (a rumour: no names, the sector only). Entries carry no text, only facts.
 */

/** Add an item to the log (stamped with `turn`, the turn it happened: a frozen fleet that catches up reports its past turns), dropping the oldest beyond NEWS_MAX. */
export function report(sim: Sim, item: Omit<NewsItem, 'id' | 'turn'>, turn: number = sim.galaxy.turn): void {
  const g = sim.galaxy;
  const entry: NewsItem = { id: g.nextNews++, turn, ...item };
  g.news.push(entry);
  if (g.news.length > NEWS_MAX) g.news.splice(0, g.news.length - NEWS_MAX);
  g.rev++;
  sim.events.emit({ type: 'galaxy.news', id: entry.id, kind: entry.kind, node: entry.node });
}

/** Has this port already reported a shortage of the item lately? (one report per port and item per NEWS_SHORTAGE_TURNS) */
export const reportedShortage = (sim: Sim, node: string, item: string, turn: number): boolean =>
  sim.galaxy.news.some((n) => n.kind === 'shortage' && n.node === node && n.item === item && turn - n.turn < NEWS_SHORTAGE_TURNS);

/** The log newest first, each with whether the player's sensors cover its place. */
export function newsFeed(sim: Sim): { item: NewsItem; precise: boolean }[] {
  const seen = nodesWithin(sim, sim.galaxy.current, SENSOR_HOPS);
  return [...sim.galaxy.news].reverse().map((item) => ({ item, precise: seen.has(item.node) }));
}
