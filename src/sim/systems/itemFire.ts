import { gridIdAt } from '../regions';
import { ItemStackC } from '../items/components';
import { takeFromStack } from '../items/stacks';
import type { Sim } from '../sim';
import { stochasticRound } from '../stochastic';
import { TICK_HZ } from '../time';
import { ITEM_BURN_PER_SEC } from '../tuning';

/**
 * Loose stacks on burning tiles burn up at a rate set by the item's flammability (content data) and
 * the fire's intensity. Items in storage are safe. The fire system reads the same flammability as fuel.
 */
export function itemFireSystem(sim: Sim): void {
  for (const id of [...sim.world.query(ItemStackC)]) {
    const s = sim.world.get(id, ItemStackC);
    const flam = s && (sim.content.items[s.item]?.flammability ?? 0);
    const grid = s && sim.grids.get(gridIdAt(sim, s.x, s.y));
    if (!s || !flam || !grid?.has('fire')) continue;
    const fire = grid.get('fire', s.x, s.y);
    if (fire === 0) continue;
    const loss = stochasticRound(sim, (flam * (fire / 255) * ITEM_BURN_PER_SEC) / TICK_HZ);
    if (loss > 0) takeFromStack(sim, id, loss);
  }
}
