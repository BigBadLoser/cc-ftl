import { upgradeRecipes } from './upgrades';
import type { RecipeDef } from '../sim';

/** The quality tiers of a cooked meal, worst first (RecipeDef.quality). */
const MEAL_QUALITY: NonNullable<RecipeDef['quality']> = {
  skill: 'cooking',
  tiers: [{ minSkill: 0, item: 'item.meal_bland' }, { minSkill: 2, item: 'item.meal_good' }, { minSkill: 6, item: 'item.meal_fine' }],
};

/** Work is in ticks (20 per second) at work speed 1. */
export const recipes = {
  'recipe.parts': {
    name: 'Machine spare parts',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 1 }, { item: 'item.electronics', count: 1 }],
    outputs: [{ item: 'item.parts', count: 2 }],
    work: 100,
  },
  // Scrapper recipes (DESIGN.md "Salvaging derelicts"): one per scrap type, 10 scrap a batch. Stripping a part yields scrap worth
  // ~40% of its build cost, and a unit of scrap makes about one unit of material, so salvage never beats mining and trade. Rare extras ~5% a batch.
  'recipe.scrap_hull': {
    name: 'Reclaim hull scrap',
    station: 'module.scrapper',
    inputs: [{ item: 'item.scrap_hull', count: 10 }],
    outputs: [{ item: 'item.metal', count: 10 }],
    work: 120,
  },
  'recipe.scrap_tech': {
    name: 'Reclaim tech scrap',
    station: 'module.scrapper',
    inputs: [{ item: 'item.scrap_tech', count: 10 }],
    outputs: [{ item: 'item.electronics', count: 6 }, { item: 'item.parts', count: 3 }],
    extras: [{ item: 'item.drone_tech', count: 1, chance: 0.05 }],
    work: 160,
  },
  'recipe.scrap_energy': {
    name: 'Reclaim energy scrap',
    station: 'module.scrapper',
    inputs: [{ item: 'item.scrap_energy', count: 10 }],
    outputs: [{ item: 'item.parts', count: 3 }, { item: 'item.electronics', count: 3 }, { item: 'item.metal', count: 4 }],
    extras: [{ item: 'item.fuel', count: 4, chance: 0.05 }],
    work: 160,
  },
  'recipe.scrap_weapons': {
    name: 'Reclaim weapons scrap',
    station: 'module.scrapper',
    inputs: [{ item: 'item.scrap_weapons', count: 10 }],
    outputs: [{ item: 'item.parts', count: 4 }, { item: 'item.metal', count: 6 }],
    extras: [{ item: 'item.missile', count: 2, chance: 0.05 }, { item: 'item.sidearm', count: 1, chance: 0.05 }],
    work: 160,
  },
  'recipe.scrap_comfort': {
    name: 'Reclaim comfort scrap',
    station: 'module.scrapper',
    inputs: [{ item: 'item.scrap_comfort', count: 10 }],
    outputs: [{ item: 'item.polymer', count: 6 }, { item: 'item.cloth', count: 4 }],
    work: 120,
  },
  // Refinery recipes: raw ore from mining pods and digging becomes building materials, worth more than the ore at any trader (issue #222;
  // the balance harness, economy.slow.test.ts, checks it). Batches are big: fetching the ore is most of a craft's time.
  'recipe.refine_iron': {
    category: 'refining',
    name: 'Refine iron ore',
    station: 'module.refinery',
    inputs: [{ item: 'item.iron_ore', count: 24 }],
    outputs: [{ item: 'item.metal', count: 20 }],
    work: 300,
  },
  'recipe.refine_rare': {
    category: 'refining',
    name: 'Refine rare ore',
    station: 'module.refinery',
    inputs: [{ item: 'item.rare_ore', count: 8 }],
    outputs: [{ item: 'item.electronics', count: 8 }],
    work: 400,
  },
  // Ice splits into water and oxygen.
  'recipe.refine_ice': {
    category: 'refining',
    name: 'Split ice',
    station: 'module.refinery',
    inputs: [{ item: 'item.ice', count: 16 }],
    outputs: [{ item: 'item.water', count: 8 }, { item: 'item.oxygen', count: 8 }],
    work: 240,
  },
  // The galley's recipe: water becomes nutrient paste bars (water: issue #222; the starter ship carries 30, for 90 rations).
  // Interim input: rations will use hydroponics output once hydroponics exists (DESIGN.md "Salvaging derelicts").
  // The emergency fallback: cooked meals (below) feed more and lift mood; rations only need water.
  'recipe.ration': {
    category: 'cooking',
    name: 'Print rations',
    station: 'module.galley',
    inputs: [{ item: 'item.water', count: 2 }],
    outputs: [{ item: 'item.ration', count: 3 }],
    work: 40,
  },
  // Meals: produce and water, cooked at the galley. The cook's cooking skill picks the quality of the batch (bland, good from level 1, fine from 3).
  'recipe.meal_greens': {
    category: 'cooking',
    name: 'Cook greens',
    station: 'module.galley',
    inputs: [{ item: 'item.greens', count: 6 }, { item: 'item.water', count: 2 }],
    outputs: [{ item: 'item.meal_good', count: 2 }],
    quality: MEAL_QUALITY,
    work: 100,
  },
  'recipe.meal_beans': {
    category: 'cooking',
    name: 'Cook protein beans',
    station: 'module.galley',
    inputs: [{ item: 'item.beans', count: 6 }, { item: 'item.water', count: 2 }],
    outputs: [{ item: 'item.meal_good', count: 2 }],
    quality: MEAL_QUALITY,
    work: 100,
  },
  'recipe.missile': {
    name: 'Assemble missiles',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 2 }, { item: 'item.electronics', count: 1 }],
    outputs: [{ item: 'item.missile', count: 2 }],
    work: 100,
  },
  'recipe.shuttle': {
    name: 'Build shuttle',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 10 }, { item: 'item.polymer', count: 10 }],
    outputs: [{ item: 'item.shuttle', count: 1 }],
    work: 600,
  },
  // Drones: parts and electronics, once their blueprint is known (research.drone.*).
  'recipe.drone_repair': {
    name: 'Build repair drone',
    station: 'module.fabricator',
    inputs: [{ item: 'item.parts', count: 4 }, { item: 'item.electronics', count: 6 }],
    outputs: [{ item: 'item.drone_repair', count: 1 }],
    work: 400,
    blueprint: 'blueprint.drone_repair',
  },
  'recipe.drone_medic': {
    name: 'Build medic drone',
    station: 'module.fabricator',
    inputs: [{ item: 'item.parts', count: 3 }, { item: 'item.electronics', count: 8 }],
    outputs: [{ item: 'item.drone_medic', count: 1 }],
    work: 400,
    blueprint: 'blueprint.drone_medic',
  },
  'recipe.drone_defence': {
    name: 'Build defence drone',
    station: 'module.fabricator',
    inputs: [{ item: 'item.parts', count: 5 }, { item: 'item.electronics', count: 6 }],
    outputs: [{ item: 'item.drone_defence', count: 1 }],
    work: 450,
    blueprint: 'blueprint.drone_defence',
  },
  'recipe.sidearm': {
    name: 'Assemble sidearm',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 4 }, { item: 'item.electronics', count: 2 }],
    outputs: [{ item: 'item.sidearm', count: 1 }],
    work: 120,
  },
  'recipe.rifle': {
    name: 'Assemble rifle',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 4 }, { item: 'item.polymer', count: 2 }],
    outputs: [{ item: 'item.rifle', count: 1 }],
    work: 220,
  },
  'recipe.blade': {
    name: 'Forge blade',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 5 }],
    outputs: [{ item: 'item.blade', count: 1 }],
    work: 100,
  },
  ...upgradeRecipes,
} satisfies Record<string, RecipeDef>;
