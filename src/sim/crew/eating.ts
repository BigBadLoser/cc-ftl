import { CrewC } from './components';
import { ammoCount } from '../combat/ammo';
import type { Sim } from '../sim';
import { HUNGER_SLEEP_MULT } from '../tuning';
import { traitMult } from './traits';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, shipId: number): string | null {
  let best: string | null = null;
  let nutrition = 0;
  for (const [item, def] of Object.entries(sim.content.items)) {
    if (def.food && def.food.nutrition > nutrition && ammoCount(sim, shipId, item) > 0) [best, nutrition] = [item, def.food.nutrition];
  }
  return best;
}

/** Hunger lost per second: the species rate, the crew member's trait, and half as fast asleep. 0 for a species that does not get hungry. */
export function hungerDrainPerSec(sim: Sim, id: number, sleeping: boolean): number {
  const species = sim.world.get(id, CrewC)?.species;
  const rate = (species && sim.content.species[species]?.hunger?.decayPerSec) || 0;
  return rate * traitMult(sim, id, 'hungerMult') * (sleeping ? HUNGER_SLEEP_MULT : 1);
}
