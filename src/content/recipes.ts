import type { RecipeDef } from '../sim';

/** Work is in ticks (20 per second) at work speed 1. */
export const recipes = {
  'recipe.metal': {
    name: 'Smelt metal',
    station: 'module.fabricator',
    inputs: [{ item: 'item.scrap', count: 2 }],
    outputs: [{ item: 'item.metal', count: 1 }],
    work: 60,
  },
  'recipe.electronics': {
    name: 'Assemble electronics',
    station: 'module.fabricator',
    inputs: [{ item: 'item.scrap', count: 3 }],
    outputs: [{ item: 'item.electronics', count: 1 }],
    work: 120,
  },
  'recipe.polymer': {
    name: 'Press polymer',
    station: 'module.fabricator',
    inputs: [{ item: 'item.scrap', count: 2 }],
    outputs: [{ item: 'item.polymer', count: 1 }],
    work: 80,
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
} satisfies Record<string, RecipeDef>;
