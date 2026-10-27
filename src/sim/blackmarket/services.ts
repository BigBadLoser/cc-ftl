import { unit } from '../galaxy/hash';
import type { ItemQty } from '../registry';
import type { Sim } from '../sim';
import type { Trader } from '../trade/types';
import type { BlackMarketDef } from './defs';

/**
 * Black-market services as the trade code sees them: which sets a trader carries (`Trader.services`), what they do to prices, the fence, and which items
 * are contraband (the `contraband` item tag). Pure reads over the trader and content; attaching a set is in attach.ts.
 */

export const CONTRABAND_TAG = 'contraband';
/** The contraband a broken-open delivery crate spills, and what is taken off a captured ship (content items; the goods stay as they were if content has none). */
export const STOLEN_GOODS = 'item.stolen_goods';
export const LOOT_GOODS = 'item.looted_goods';

export const isContraband = (sim: Sim, item: string): boolean => !!sim.content.items[item]?.tags.includes(CONTRABAND_TAG);

/** Every contraband item id, ascending. */
export const contrabandItems = (sim: Sim): string[] =>
  Object.keys(sim.content.items).filter((id) => isContraband(sim, id)).sort();

/** The sets a trader carries that exist in content, in the order they were attached. */
export function setsOf(sim: Sim, t: Pick<Trader, 'services'>): BlackMarketDef[] {
  const defs = sim.content.blackMarkets;
  return (t.services ?? []).map((id) => defs?.[id]).filter((d): d is BlackMarketDef => !!d);
}

/** Items the carried sets stock. They sit on the station's shelf beside the port market's goods and are not part of its economy. */
export function serviceItems(sim: Sim, t: Pick<Trader, 'services'>): Set<string> {
  const out = new Set<string>();
  for (const d of setsOf(sim, t)) for (const l of d.stock) out.add(l.item);
  return out;
}

/** The share of an item's value the trader pays for contraband, or null when it takes none (a legitimate trader refuses it). */
export function contrabandRate(sim: Sim, t: Pick<Trader, 'services'>): number | null {
  const rates = setsOf(sim, t).map((d) => d.contrabandBuy);
  return rates.length ? Math.max(...rates) : null;
}

/** Service price multiplier for one side of one item: the sets' own and their tag mods. */
export function serviceFactor(sim: Sim, t: Pick<Trader, 'services'>, item: string, side: 'sell' | 'buy'): number {
  let p = 1;
  for (const d of setsOf(sim, t)) {
    p *= d[side] ?? 1;
    for (const tag of sim.content.items[item]?.tags ?? []) p *= d.tagMods?.[tag]?.[side] ?? 1;
  }
  return p;
}

/** A station's identity number for rolls: its generator seed, else its entity id. */
export const stationIdentity = (seed: number | undefined, station: number): number => seed ?? station;

/** The fence rate rolled for a station: a share of value in the set's [min, max], a function of the world seed and the station. */
export function rollFence(sim: Sim, def: BlackMarketDef, identity: number): number | undefined {
  if (!def.fence) return undefined;
  const u = unit(sim.seed, identity, 0xfe2c);
  return Math.round((def.fence.min + (def.fence.max - def.fence.min) * u) * 1000) / 1000;
}

/** Does this trader's hail follow the zealot rule (a machine-cult market)? */
export const zealotRule = (sim: Sim, t: Pick<Trader, 'services'>): boolean => setsOf(sim, t).some((d) => d.rule === 'zealot');

/** The stock lines of a set as a station rolls them: counts and chances from the seed, a pure function of (seed, identity, set). */
export function rollServiceStock(sim: Sim, def: BlackMarketDef, identity: number, salt: number): ItemQty[] {
  const out: ItemQty[] = [];
  def.stock.forEach((line, i) => {
    if (!sim.content.items[line.item]) return;
    if (line.chance !== undefined && unit(sim.seed, identity, salt, i, 1) >= line.chance) return;
    const count = line.min + Math.floor(unit(sim.seed, identity, salt, i, 2) * (line.max - line.min + 1));
    if (count > 0) out.push({ item: line.item, count });
  });
  return out;
}
