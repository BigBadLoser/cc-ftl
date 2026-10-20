import type { RoomRecipe } from './types';

/**
 * Galley and mess (the 'support' role: lounges and crew hubs): life support and the fabricator on the walls, one
 * galley counter per ship on a wall, mess tables with chairs in the middle with walkways around them.
 */
export const mess = {
  fill: 0.5,
  arrangements: [
    {
      name: 'mess hall', weight: 2, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
        { mod: 'module.fabricator', count: 'spec', wall: 'long' },
        { mod: 'module.galley', count: 1, once: true, wall: 'long', minFloor: 12 },
        { mod: 'module.mess_table', count: 'fill', centre: 'y', grid: [3, 4], rots: [0], with: { mod: 'module.chair', n: 4 } },
        { mod: 'module.storage_locker', count: 2, wall: 'end' },
      ],
    },
    {
      name: 'canteen', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.fabricator', count: 'spec', wall: 'any' },
        { mod: 'module.galley', count: 1, once: true, wall: 'end', minFloor: 12 },
        { mod: 'module.mess_table', count: 'fill', wall: 'long', grid: [4, 1], rots: [0], with: { mod: 'module.chair', n: 2 } },
        { mod: 'module.hydroponics', count: 2, wall: 'any', row: true },
      ],
    },
    {
      name: 'lounge', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.fabricator', count: 'spec', wall: 'any' },
        { mod: 'module.galley', count: 1, once: true, wall: 'any', minFloor: 16 },
        { mod: 'module.mess_table', count: 'fill', centre: 'xy', grid: [4, 3], rots: [1], with: { mod: 'module.chair', n: 2 } },
        { mod: ['module.hydroponics', 'module.storage_locker'], count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
