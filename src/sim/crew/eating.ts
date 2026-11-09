import { CrewC } from './components';
import { hasStock } from '../combat/ammo';
import type { Sim } from '../sim';
import { HUNGER_SLEEP_MULT } from '../tuning';
import { traitMult } from './traits';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, shipId: number): string | null {
  for (const item of foodsOf(sim)) if (hasStock(sim, shipId, item)) return item;
  return null;
}

const foods = new WeakMap<object, string[]>();
/** The food items of the content, most nutritious first (ties in content order, as the scan that kept the first best). */
function foodsOf(sim: Sim): string[] {
  let f = foods.get(sim.content.items);
  if (!f) {
    const all = Object.entries(sim.content.items).filter(([, d]) => d.food && d.food.nutrition > 0);
    f = all.map(([id], i) => ({ id, i, n: all[i]?.[1].food?.nutrition ?? 0 })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.id);
    foods.set(sim.content.items, f);
  }
  return f;
}

/** Hunger lost per second: the species rate, the crew member's trait, and half as fast asleep. 0 for a species that does not get hungry. */
export function hungerDrainPerSec(sim: Sim, id: number, sleeping: boolean): number {
  const species = sim.world.get(id, CrewC)?.species;
  const rate = (species && sim.content.species[species]?.hunger?.decayPerSec) || 0;
  return rate * traitMult(sim, id, 'hungerMult') * (sleeping ? HUNGER_SLEEP_MULT : 1);
}
