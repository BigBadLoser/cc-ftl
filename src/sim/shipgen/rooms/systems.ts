import type { Arrangement, RoomRecipe } from './types';

/**
 * Recipes for rooms built around hull or roof mounts: weapons, shields, engines, docks and hangars. Their planned
 * modules keep the generic placer and its mount rules (no 'spec' steps here); recipes only furnish around them:
 * a duty console, battery banks, lockers and racks on the walls, with access and the door approach kept clear.
 */
const around = (name: string, weight: number, steps: Arrangement['steps']): Arrangement => ({ name, weight, steps });

export const weapons = {
  fill: 0.6,
  arrangements: [
    around('loader', 2, [
      { mod: 'module.storage_rack', count: 2, wall: 'any', row: true },
      { mod: 'module.battery', count: 2, wall: 'any', row: true },
    ]),
    around('duty', 1, [
      { mod: 'module.console', count: 1, wall: 'any', face: 'in' },
      { mod: ['module.storage_locker', 'module.battery'], count: 3, wall: 'any', row: true },
    ]),
  ],
} as const satisfies RoomRecipe;

export const shields = {
  fill: 0.6,
  arrangements: [
    around('banks', 2, [{ mod: 'module.battery', count: 4, wall: 'any', row: true }]),
    around('monitor', 1, [
      { mod: 'module.console', count: 1, wall: 'any' },
      { mod: 'module.battery', count: 2, wall: 'any', row: true },
      { mod: 'module.storage_locker', count: 2, wall: 'any', row: true },
    ]),
  ],
} as const satisfies RoomRecipe;

export const engines = {
  fill: 0.6,
  arrangements: [
    around('control', 2, [
      { mod: 'module.console', count: 1, wall: 'fore' },
      { mod: 'module.battery', count: 3, wall: 'any', row: true },
    ]),
    around('workshop', 1, [
      { mod: 'module.storage_rack', count: 1, wall: 'long' },
      { mod: ['module.storage_locker', 'module.battery'], count: 3, wall: 'any', row: true },
    ]),
  ],
} as const satisfies RoomRecipe;

/** Docks: suit and gear lockers beside the airlock; its inside and unloader stands stay clear (protected tiles). */
export const dock = {
  fill: 0.6,
  arrangements: [
    around('suits', 2, [{ mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true }]),
    around('freight', 1, [
      { mod: 'module.storage_rack', count: 1, wall: 'any' },
      { mod: 'module.storage', count: 'fill', wall: 'any', row: true },
    ]),
  ],
} as const satisfies RoomRecipe;

/** Hangars: tool racks and lockers along the walls, the bay's boarding side kept clear. */
export const hangar = {
  fill: 0.55,
  arrangements: [
    around('racks', 2, [
      { mod: 'module.storage_rack', count: 'fill', wall: 'long', row: true },
      { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
    ]),
    around('pallets', 1, [
      { mod: 'module.storage_pallet', count: 2, wall: 'any' },
      { mod: ['module.storage', 'module.battery'], count: 'fill', wall: 'any', row: true },
    ]),
  ],
} as const satisfies RoomRecipe;
