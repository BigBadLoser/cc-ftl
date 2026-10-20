import type { RoomRecipe } from './types';

/** Crew quarters: beds in rows along the walls, lockers between them, life support at an end. */
export const quarters = {
  fill: 0.55,
  arrangements: [
    {
      name: 'bunks', weight: 2, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'end' },
        { mod: 'module.bed', count: 'spec', wall: 'long', row: true, rots: [0] },
        { mod: 'module.storage_locker', count: 'fill', wall: 'long', near: 'module.bed', row: true },
      ],
    },
    {
      name: 'berths', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'end', row: true, rots: [1, 3] },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', near: 'module.bed' },
      ],
    },
    {
      name: 'cabin', weight: 1, steps: [
        { mod: 'module.lifeSupport', count: 'spec', wall: 'any' },
        { mod: 'module.bed', count: 'spec', wall: 'any', row: true },
        { mod: 'module.storage_locker', count: 1, wall: 'any', near: 'module.bed' },
        { mod: ['module.chair', 'module.storage_locker'], count: 'fill', wall: 'any', face: 'in' },
      ],
    },
  ],
} as const satisfies RoomRecipe;
