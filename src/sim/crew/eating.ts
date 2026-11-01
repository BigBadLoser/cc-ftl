import { ammoCount } from '../combat/ammo';
import type { Sim } from '../sim';
import { HUNGER_EAT_BELOW, HUNGER_EAT_URGENT } from '../tuning';
import { NeedsC } from './components';
import { traitEffect } from './traits';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, shipId: number): string | null {
  let best: string | null = null;
  let nutrition = 0;
  for (const [item, def] of Object.entries(sim.content.items)) {
    if (def.food && def.food.nutrition > nutrition && ammoCount(sim, shipId, item) > 0) [best, nutrition] = [item, def.food.nutrition];
  }
  return best;
}

/** True when the crew member is hungry enough to stop work and eat (operators hold their post until it is urgent; a Glutton goes sooner). */
export function wantsToEat(sim: Sim, id: number, operating: boolean): boolean {
  const hunger = sim.world.get(id, NeedsC)?.hunger;
  return hunger !== undefined && hunger < (operating ? HUNGER_EAT_URGENT : traitEffect(sim, id, 'eatBelow') ?? HUNGER_EAT_BELOW);
}
