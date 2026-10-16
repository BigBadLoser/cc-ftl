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
} satisfies Record<string, RecipeDef>;
