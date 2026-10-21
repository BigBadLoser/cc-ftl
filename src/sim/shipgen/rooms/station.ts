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
        { mod: 'module.refinery', count: 'spec', wall: 'long', row: true },
        { mod: 'module.storage_pallet', count: 'fill', pack: true },
        { mod: 'module.storage', count: 'fill', pack: true },
      ],
    },
    {
      name: 'ore hall', weight: 1, walkway: 'cross', steps: [
        { mod: 'module.refinery', count: 'spec', wall: 'any' },
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
