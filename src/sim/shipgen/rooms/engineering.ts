import type { RoomRecipe } from './types';

/** Engineering (reactor rooms): reactors with clear floor around them for access, one or two battery banks, a console, a locker or a rack or two on the walls. */
export const engineering = {
  fill: 0.5,
  arrangements: [
    {
      name: 'core', weight: 2, steps: [
        { mod: 'module.reactor', count: 'spec', centre: 'y', clear: 1, row: true },
        { mod: 'module.battery', count: 2, wall: 'long', row: true },
        { mod: 'module.console', count: 1, wall: 'any' },
        { mod: 'module.storage_locker', count: 2, wall: 'any', row: true },
      ],
    },
    {
      name: 'banked', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'long', row: true },
        { mod: 'module.battery', count: 1, wall: 'any' },
        { mod: ['module.storage_locker', 'module.storage_rack'], count: 2, wall: 'any', row: true },
      ],
    },
    {
      name: 'stores', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'end', clear: 1 },
        { mod: 'module.storage_rack', count: 2, wall: 'long', row: true },
        { mod: 'module.battery', count: 2, wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
