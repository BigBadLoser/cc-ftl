import { AllegianceC, CrewC, DeadC, NeedsC, type Sim } from '../sim';
import type { UiFood, UiStock } from '../ui/api';

/** Nutrition used for the rate when there is no food in stock to average (a ration). */
const FALLBACK_NUTRITION = 50;

/**
 * The crew's food situation: food units in storage (every item with `food`), how many player crew eat, how fast
 * they use it and how long it lasts at that rate. `stock` is the output of buildStock; only its `stored` counts,
 * because crew eat from storage alone (food on the floor or in hand waits to be hauled).
 * The rate is the awake decay (sleepers eat half as fast), so the estimate errs on the short side.
 */
export function buildFood(sim: Sim, stock: readonly UiStock[]): UiFood {
  let units = 0;
  let nutrition = 0;
  for (const s of stock) {
    const food = sim.content.items[s.item]?.food;
    if (!food) continue;
    const n = s.stored;
    units += n;
    nutrition += n * food.nutrition;
  }
  // Eaters: living player crew of a species that gets hungry (robots have none).
  let eaters = 0;
  let decayPerSec = 0;
  for (const id of sim.world.query(CrewC, NeedsC)) {
    const crew = sim.world.get(id, CrewC);
    const decay = crew && sim.content.species[crew.species]?.hunger?.decayPerSec;
    if (!decay || sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player') continue;
    eaters++;
    decayPerSec += decay;
  }
  const perNutrition = units > 0 ? nutrition / units : FALLBACK_NUTRITION;
  const perHour = (decayPerSec * 3600) / perNutrition;
  const hours = eaters === 0 ? null : nutrition / (decayPerSec * 3600);
  return { units, eaters, perHour: Math.round(perHour * 10) / 10, hours: hours === null ? null : Math.round(hours * 100) / 100 };
}
