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

/** The recipe's inputs are all in the player's stock now (so a craft of it can be supplied). */
export function inputsInStock(sim: Sim, recipeId: string): boolean {
  const recipe = sim.content.recipes[recipeId];
  return !!recipe && recipe.inputs.every((l) => totalStock(sim, l.item) >= l.count);
}

/**
 * The order a crafting module should work on next: the first wanting a batch whose inputs are in stock, else the first wanting one (its job
 * waits for materials). A refinery queued for every ore refines whatever ore there is instead of stalling on the first.
 */
export function nextOrder(sim: Sim, moduleId: number): ProductionOrder | null {
  const orders = sim.world.get(moduleId, ProductionC)?.orders ?? [];
  return orders.find((o) => orderWantsMore(sim, o) && inputsInStock(sim, o.recipe)) ?? activeOrder(sim, moduleId);
}
