import { CrewC } from './components';
import { storagesOn } from '../combat/ammo';
import { StorageC } from '../items/components';
import type { Sim } from '../sim';
import { HUNGER_SLEEP_MULT } from '../tuning';
import { traitMult } from './traits';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, shipId: number): string | null {
  // One pass over the grid's stacks, keeping the best-ranked food held (the same answer as asking each food in turn, which scanned every
  // storage once per food: a station without food did that for every crew member every tick).
  const f = foodsOf(sim);
  let best = f.ranks.size;
  for (const id of storagesOn(sim, shipId)) {
    const stacks = sim.world.get(id, StorageC)?.stacks;
    if (!stacks) continue;
    for (const st of stacks) {
      if (st.count <= 0) continue;
      const r = f.ranks.get(st.item);
      if (r !== undefined && r < best) {
        if (r === 0) return f.ids[0] ?? null;
        best = r;
      }
    }
  }
  return f.ids[best] ?? null;
}

const foods = new WeakMap<object, { ids: string[]; ranks: Map<string, number> }>();
/** The food items of the content, most nutritious first (ties in content order, as the scan that kept the first best), and each one's rank. */
function foodsOf(sim: Sim): { ids: string[]; ranks: Map<string, number> } {
  let f = foods.get(sim.content.items);
  if (!f) {
    const all = Object.entries(sim.content.items).filter(([, d]) => d.food && d.food.nutrition > 0);
    const ids = all.map(([id], i) => ({ id, i, n: all[i]?.[1].food?.nutrition ?? 0 })).sort((a, b) => b.n - a.n || a.i - b.i).map((x) => x.id);
    f = { ids, ranks: new Map(ids.map((id, i) => [id, i])) };
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
