import type { RoomRecipe } from './types';

/**
 * Plant rooms (stations: the engineering band on the secure core's side of the ring): life support, battery banks and
 * a radiator on the walls, a duty console, the walkway between kept clear.
 */
export const plant = {
  fill: 0.5,
  arrangements: [
    {
      name: 'plant', weight: 2, steps: [
        { mod: 'module.lifeSupport', count: 1, wall: 'end' },
        { mod: 'module.battery', count: 2, wall: 'long', row: true },
        { mod: 'module.radiator', count: 1, wall: 'any' },
        { mod: 'module.console', count: 1, wall: 'any' },
      ],
    },
    {
      name: 'cells', weight: 1, steps: [
        { mod: 'module.battery', count: 3, wall: 'long', row: true },
        { mod: 'module.lifeSupport', count: 1, wall: 'any' },
        { mod: 'module.storage_rack', count: 1, wall: 'any' },
      ],
    },
  ],
} as const satisfies RoomRecipe;
