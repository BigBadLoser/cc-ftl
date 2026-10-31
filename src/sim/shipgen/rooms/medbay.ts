import type { RoomRecipe } from './types';

/**
 * Medbays (stations: one a habitation run, at its busy end, the buffer between the cabins and the rest). Sickbay cots
 * along the long walls (no healing yet: the room is ready for it), a duty console, lockers for supplies.
 */
export const medbay = {
  fill: 0.5,
  arrangements: [
    {
      name: 'ward', weight: 2, steps: [
        { mod: 'module.med_bed', count: 'spec', wall: 'long', row: true },
        { mod: 'module.console', count: 1, wall: 'end' },
        { mod: 'module.storage_locker', count: 2, wall: 'any', row: true },
      ],
    },
    {
      name: 'clinic', weight: 1, steps: [
        { mod: 'module.med_bed', count: 'spec', wall: 'any' },
        { mod: 'module.storage_locker', count: 1, wall: 'end' },
        { mod: 'module.planter', count: 1, wall: 'any' },
      ],
    },
  ],
} as const satisfies RoomRecipe;
