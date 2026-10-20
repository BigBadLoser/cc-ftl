import type { RoomRecipe } from './types';

/** Engineering (reactor rooms): reactors with clear floor around them for access, battery banks and lockers on the walls. */
export const engineering = {
  fill: 0.5,
  arrangements: [
    {
      name: 'core', weight: 2, steps: [
        { mod: 'module.reactor', count: 'spec', centre: 'y', clear: 1, row: true },
        { mod: 'module.battery', count: 'fill', wall: 'long', row: true },
      ],
    },
    {
      name: 'banked', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'long', row: true },
        { mod: ['module.battery', 'module.storage_locker'], count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'stores', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'end', clear: 1 },
        { mod: 'module.storage_rack', count: 2, wall: 'long', row: true },
        { mod: 'module.battery', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
