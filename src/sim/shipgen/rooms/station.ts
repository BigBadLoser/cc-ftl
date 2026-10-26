import type { RoomRecipe } from './types';

/**
 * Station rooms. Farms: rows of hydroponics beds with walkways between them. Industry: refineries on the walls, ore
 * pallets and containers packed round one walkway. Armoury: weapon lockers (stocked with hand weapons) and racks.
 */
export const farm = {
  fill: 0.6,
  arrangements: [
    {
      name: 'grow rows', weight: 2, walkway: 'long', steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
        { mod: 'module.hydroponics', count: 'spec', row: true, rots: [0] },
        { mod: 'module.hydroponics', count: 'fill', row: true, rots: [0] },
      ],
    },
    {
      name: 'grow beds', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.hydroponics', count: 'spec', wall: 'any', row: true },
        { mod: ['module.hydroponics', 'module.storage_locker'], count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

export const industry = {
  fill: 0.7,
  arrangements: [
    {
      name: 'refinery floor', weight: 2, walkway: 'long', steps: [
        { mod: 'module.refinery', count: 'spec', wall: 'long', row: true, with: { mod: 'module.storage_ore', n: 2, big: 'module.storage_ore_large' } },
        { mod: 'module.storage_pallet', count: 'fill', pack: true },
      ],
    },
    {
      name: 'ore hall', weight: 1, walkway: 'cross', steps: [
        { mod: 'module.refinery', count: 'spec', wall: 'any', with: { mod: 'module.storage_ore', n: 1, big: 'module.storage_ore_large' } },
        { mod: 'module.cargo_container', count: 'fill', pack: true, wall: 'long' },
        { mod: 'module.storage_pallet', count: 'fill', pack: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

export const armoury = {
  fill: 0.6,
  arrangements: [
    {
      name: 'locker room', weight: 1, walkway: 'long', steps: [
        { mod: 'module.storage_locker', count: 'spec', wall: 'long', row: true },
        { mod: 'module.storage_rack', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/** Concourse (trading courtyards): stalls (pallets and lockers) and benches (tables with chairs) in open space. */
export const plaza = {
  fill: 0.12,
  arrangements: [
    {
      // Stall rows: containers and pallets in pairs along aisles, benches between the rows.
      name: 'market', weight: 2, walkway: 'long', steps: [
        { mod: 'module.cargo_container', count: 'fill', upTo: 0.1, clear: 1, grid: [7, 5], rots: [0], with: { mod: 'module.storage_pallet', n: 2 } },
        { mod: 'module.mess_table', count: 'fill', upTo: 0.14, clear: 1, grid: [7, 5], rots: [0], with: { mod: 'module.chair', n: 4 } },
        { mod: 'module.hydroponics', count: 4, wall: 'any' },
      ],
    },
    {
      name: 'food court', weight: 1, steps: [
        { mod: 'module.galley', count: 2, wall: 'any' },
        { mod: 'module.mess_table', count: 'fill', upTo: 0.12, clear: 2, grid: [6, 5], rots: [0], with: { mod: 'module.chair', n: 4 } },
        { mod: 'module.storage_locker', count: 4, wall: 'any' },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/** Garden deck (farming courtyards): hydroponics beds in rows, a few benches. */
export const garden = {
  fill: 0.18,
  arrangements: [
    {
      name: 'garden', weight: 1, steps: [
        { mod: 'module.hydroponics', count: 'fill', upTo: 0.16, clear: 1, grid: [3, 3], rots: [0] },
        { mod: 'module.mess_table', count: 3, clear: 1, rots: [0], with: { mod: 'module.chair', n: 2 } },
      ],
    },
  ],
} as const satisfies RoomRecipe;

/** Drill hall (military courtyards): open floor, racks and lockers on the walls. */
export const drill = {
  fill: 0.06,
  arrangements: [
    {
      name: 'drill hall', weight: 1, steps: [
        { mod: 'module.storage_rack', count: 'fill', wall: 'any', row: true },
        { mod: 'module.storage_locker', count: 6, wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
