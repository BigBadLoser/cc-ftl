import type { RoomRecipe } from './types';

/**
 * Shops (stations: the market street and the market ring). Decorative: trade itself is the station's storage and the
 * docked shuttle. Built from pieces with art (no counter or stall asset): goods on racks and pallets, a cafe's tables, an
 * outfitter's lockers, each with a holo sign.
 */
export const shop = {
  fill: 0.5,
  arrangements: [
    {
      name: 'goods', weight: 3, steps: [
        { mod: 'module.holo_sign', count: 1, once: true, wall: 'end' },
        { mod: 'module.storage_rack', count: 3, wall: 'long', row: true },
        { mod: 'module.storage_pallet', count: 1, wall: 'any' },
      ],
    },
    {
      name: 'cafe', weight: 2, steps: [
        { mod: 'module.holo_sign', count: 1, once: true, wall: 'end' },
        { mod: 'module.mess_table', count: 'fill', upTo: 0.5, clear: 1, centre: 'xy', grid: [3, 4], rots: [0], with: { mod: 'module.chair', n: 2 } },
        { mod: 'module.planter', count: 1, wall: 'any' },
      ],
    },
    {
      name: 'outfitter', weight: 1, steps: [
        { mod: 'module.holo_sign', count: 1, once: true, wall: 'end' },
        { mod: 'module.storage_locker', count: 3, wall: 'long', row: true },
        { mod: 'module.storage_rack', count: 1, wall: 'any' },
      ],
    },
  ],
} as const satisfies RoomRecipe;
