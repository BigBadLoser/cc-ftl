import type { Sim } from '../sim';
import { ProductionC, type ProductionOrder } from './components';
import { totalStock } from './stock';

/** True while an order still has batches to make. 'keep' compares total stock of the recipe's first output. */
export function orderWantsMore(sim: Sim, o: ProductionOrder): boolean {
  const recipe = sim.content.recipes[o.recipe];
  if (!recipe) return false;
  if (o.mode === 'count') return o.done < o.target;
  const out = recipe.outputs[0];
  return !!out && totalStock(sim, out.item) < o.target;
}

/** The first order on a crafting module that still wants a batch, or null. */
export function activeOrder(sim: Sim, moduleId: number): ProductionOrder | null {
  for (const o of sim.world.get(moduleId, ProductionC)?.orders ?? []) if (orderWantsMore(sim, o)) return o;
  return null;
}
