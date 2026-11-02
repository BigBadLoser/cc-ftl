import { ammoCount } from '../combat/ammo';
import type { Sim } from '../sim';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, shipId: number): string | null {
  let best: string | null = null;
  let nutrition = 0;
  for (const [item, def] of Object.entries(sim.content.items)) {
    if (def.food && def.food.nutrition > nutrition && ammoCount(sim, shipId, item) > 0) [best, nutrition] = [item, def.food.nutrition];
  }
  return best;
}
