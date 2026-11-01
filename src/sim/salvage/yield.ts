import type { ItemQty, ScrapType } from '../registry';
import { spillItems } from '../items/stacks';
import { stochasticRound } from '../stochastic';
import { SALVAGE_FRAC } from '../tuning';
import type { Sim } from '../sim';
import { SalvageOrderC } from './components';

/** The item a scrap type is stored as. */
export const scrapItem = (type: ScrapType): string => `item.scrap_${type}`;

/**
 * Scrap units a part of build `cost` gives: its item count x SALVAGE_FRAC, rounded stochastically (sim rng, so a seed always
 * gives the same haul) and held strictly below the count, so stripping never returns what building cost (a 1-item floor gives nothing).
 * A unit of scrap makes about one unit of material at the scrapper, so counting items is counting value.
 */
export function salvageYield(sim: Sim, cost: readonly ItemQty[] | undefined): number {
  const total = (cost ?? []).reduce((n, q) => n + q.count, 0);
  if (total <= 1) return 0;
  return Math.min(stochasticRound(sim, total * SALVAGE_FRAC), total - 1);
}

/** The average of `salvageYield` for `cost` over the rng (what the inspector's estimate sums), without rolling it. */
export function expectedYield(cost: readonly ItemQty[] | undefined): number {
  const total = (cost ?? []).reduce((n, q) => n + q.count, 0);
  return total <= 1 ? 0 : Math.min(total * SALVAGE_FRAC, total - 1);
}

/** Strip a part: drop its scrap (of `type`) on or near a tile. Returns the units made (lost ones included when the deck has no room). */
export function spillScrap(sim: Sim, ship: number, x: number, y: number, type: ScrapType, cost: readonly ItemQty[] | undefined): number {
  const order = sim.world.get(ship, SalvageOrderC);
  if (order) order.done++; // one stripping job finished (even a floor that yields nothing)
  const n = salvageYield(sim, cost);
  if (n > 0) spillItems(sim, ship, x, y, scrapItem(type), n);
  return n;
}
