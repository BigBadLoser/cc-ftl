import type { RoomRecipe } from './types';

/** Crew quarters: beds in rows along the walls, a locker a bed, life support at an end. */
export const quarters = {
  fill: 0.55,
  arrangements: [
    {
      name: 'bunks', weight: 2, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
        { mod: 'module.bed', count: 'spec', wall: 'long', row: true, rots: [0] },
        { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'long' },
        { mod: 'module.storage_locker', count: 'fill', per: 'module.bed', wall: 'long', near: 'module.bed', row: true },
      ],
    },
    {
      name: 'berths', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'end', row: true, rots: [1, 3] },
        { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'any' },
        { mod: 'module.chair', count: 1, wall: 'any', face: 'in' },
        { mod: 'module.storage_locker', count: 'fill', per: 'module.bed', wall: 'any', near: 'module.bed' },
      ],
    },
    {
      name: 'cabin', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'any', row: true },
        { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'any' },
        { mod: 'module.storage_locker', count: 1, wall: 'any', near: 'module.bed' },
        { mod: 'module.mess_table', count: 1, wall: 'any', minFloor: 9, with: { mod: 'module.chair', n: 1 } },
      ],
    },
    {
      name: 'studio', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'end', row: true },
        { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'end' },
        { mod: 'module.mess_table', count: 1, wall: 'long', with: { mod: 'module.chair', n: 1 } },
        { mod: ['module.hydroponics', 'module.storage_locker'], count: 1, wall: 'any' },
      ],
    },
    {
      name: 'locker room', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'long', row: true },
        { mod: 'module.bed', count: 1, unless: 'module.bed', wall: 'long' },
        { mod: 'module.storage_locker', count: 'fill', per: 'module.bed', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
