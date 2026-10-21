import type { RoomRecipe } from './types';

const pack = { count: 'fill', pack: true } as const;

/**
 * Storage and cargo holds: packed nearly solid with containers, pallets, racks and crates around ONE clear walkway
 * (a spine joined to every door and protected tile). Half the planned crates go in; the rest of the stock space
 * comes from the bigger pieces, so holds of one size still differ.
 */
export const storage = {
  fill: 0.85,
  arrangements: [
    {
      name: 'container hold', weight: 2, walkway: 'long', steps: [
        { mod: 'module.cargo_container', ...pack, wall: 'long' },
        { mod: 'module.storage_pallet', ...pack },
        { mod: 'module.storage', count: 'spec', share: 0.5, pack: true },
        { mod: ['module.storage', 'module.storage_locker'], ...pack },
      ],
    },
    {
      name: 'pallet hold', weight: 2, walkway: 'cross', steps: [
        { mod: 'module.storage_pallet', ...pack, wall: 'any' },
        { mod: 'module.storage', count: 'spec', share: 0.5, pack: true },
        { mod: 'module.storage_rack', ...pack },
        { mod: 'module.storage', ...pack },
      ],
    },
    {
      name: 'racked aisle', weight: 1, walkway: 'long', steps: [
        { mod: 'module.storage', count: 'spec', share: 0.6, wall: 'end', pack: true },
        { mod: 'module.storage_rack', ...pack, wall: 'long', row: true },
        { mod: ['module.storage', 'module.storage_locker'], ...pack },
      ],
    },
  ],
} as const satisfies RoomRecipe;
