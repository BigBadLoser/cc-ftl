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
  'recipe.parts': {
    name: 'Machine spare parts',
    station: 'module.fabricator',
    inputs: [{ item: 'item.metal', count: 1 }, { item: 'item.electronics', count: 1 }],
    outputs: [{ item: 'item.parts', count: 2 }],
    work: 100,
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
} satisfies Record<string, RecipeDef>;
