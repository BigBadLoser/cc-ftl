import { batteryBank } from './islandSets';
import type { RoomRecipe } from './types';

/** Engineering (reactor rooms): reactors with clear floor around them for access, one or two battery banks, a console, lockers and racks on the walls. */
export const engineering = {
  fill: 0.5,
  islands: [batteryBank],
  arrangements: [
    {
      // Laid out whole from a design (rooms/designs.ts); the steps are its fallback in a room no design fits.
      // The fallback is the most forgiving arrangement (reactors against a wall): rooms no design fits are the tight ones.
      name: 'designed', weight: 10, plan: { kind: 'design', designs: ['plantRow', 'twinFlank', 'plinth'] }, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'long', row: true },
        { mod: 'module.battery', count: 1, wall: 'any' },
        { mod: ['module.storage_locker', 'module.storage_rack'], count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'core', weight: 2, steps: [
        { mod: 'module.reactor', count: 'spec', centre: 'y', clear: 1, row: true },
        { mod: 'module.battery', count: 2, wall: 'long', row: true },
        { mod: 'module.console', count: 1, wall: 'any' },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'banked', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'long', row: true },
        { mod: 'module.battery', count: 1, wall: 'any' },
        { mod: ['module.storage_locker', 'module.storage_rack'], count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'stores', weight: 1, steps: [
        { mod: 'module.reactor', count: 'spec', wall: 'end', clear: 1 },
        { mod: 'module.storage_rack', count: 2, wall: 'long', row: true },
        { mod: 'module.battery', count: 2, wall: 'any', row: true },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
