import { EggSacC, NestC } from '../aliens/components';
import { factionsHostile } from '../combat/factions';
import { CrewC, DeadC, PositionC } from '../crew/components';
import { AllegianceC, SurrenderedC } from '../fight/components';
import { structCostKey } from '../items/stacks';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { ItemQty, ScrapType } from '../registry';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { SCRAP_TYPES } from './components';
import { partCount, partsOf } from './plan';
import { scrapItem, expectedYield } from './yield';

/** What stripping one scrap type from a wreck would take and give. */
export interface SalvageCount {
  /** Parts of this type still on the wreck. */
  parts: number;
  /** Scrap units they are expected to give (an average over the rng). */
  scrap: number;
  /** What a scrapper makes of that scrap, from the content recipe (an average; the rare extras are left out). */
  materials: ItemQty[];
}

/**
 * Read-only: per scrap type, how many parts of `ship` an order would strip and about what they yield (the inspector's tick boxes and
 * tooltips). Uses the planner's own `partsOf`, so the counts are exactly what an order would strip.
 */
export function salvageCounts(sim: Sim, ship: number): Record<ScrapType, SalvageCount> {
  const out = {} as Record<ScrapType, SalvageCount>;
  for (const type of SCRAP_TYPES) {
    const parts = partsOf(sim, ship, [type]);
    let scrap = 0;
    for (const id of parts.modules) scrap += expectedYield(sim.content.modules[sim.world.get(id, ModuleC)!.def]?.cost);
    for (const t of parts.walls) scrap += expectedYield(sim.content.structCosts[structCostKey(t.kind) ?? '']);
    scrap += parts.floors.length * expectedYield(sim.content.structCosts[structCostKey(Struct.Floor) ?? '']);
    out[type] = { parts: partCount(parts), scrap, materials: materialsFor(sim, type, scrap) };
  }
  return out;
}

/** The materials `scrap` units of `type` make at a scrapper: the recipe whose input is that scrap, scaled (batches need not be whole). */
function materialsFor(sim: Sim, type: ScrapType, scrap: number): ItemQty[] {
  const item = scrapItem(type);
  const recipe = Object.values(sim.content.recipes).find((r) => r.inputs.length === 1 && r.inputs[0]!.item === item);
  if (!recipe || scrap <= 0) return [];
  const per = recipe.inputs[0]!.count;
  return recipe.outputs.map((o) => ({ item: o.item, count: Math.round((o.count * scrap) / per) })).filter((q) => q.count > 0);
}

/** What is hostile aboard a wreck: living, non-surrendered hostile crew, egg sacs, nests (the reasons an order is blocked). */
export function hostilesAboard(sim: Sim, ship: number): { crew: number; sacs: number; nests: number } {
  let crew = 0, sacs = 0, nests = 0;
  for (const id of sim.world.query(CrewC, PositionC, AllegianceC)) {
    if (sim.world.has(id, DeadC) || sim.world.has(id, SurrenderedC)) continue;
    if (factionsHostile(sim.world.get(id, AllegianceC)?.faction, 'player') && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) crew++;
  }
  for (const id of sim.world.query(EggSacC)) if (sim.world.get(id, EggSacC)?.ship === ship) sacs++;
  for (const id of sim.world.query(NestC)) if (sim.world.get(id, NestC)?.ship === ship) nests++;
  return { crew, sacs, nests };
}
