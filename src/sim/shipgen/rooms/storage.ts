import type { RoomRecipe } from './types';

/** Storage: racks along the walls facing a clear aisle, crates and pallets in the middle bays. */
export const storage = {
  fill: 0.6,
  arrangements: [
    {
      name: 'aisle', weight: 2, steps: [
        { mod: 'module.storage', count: 'spec', wall: 'long', row: true },
        { mod: 'module.storage_rack', count: 'fill', wall: 'long', row: true },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'pallets', weight: 1, steps: [
        { mod: 'module.storage', count: 'spec', wall: 'any', row: true },
        { mod: 'module.storage_pallet', count: 'fill', wall: 'end', row: true },
        { mod: 'module.storage_rack', count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'stacks', weight: 1, steps: [
        { mod: 'module.storage', count: 'spec', wall: 'end', row: true },
        { mod: ['module.storage_rack', 'module.storage_pallet'], count: 'fill', wall: 'any', row: true },
        { mod: 'module.storage', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
