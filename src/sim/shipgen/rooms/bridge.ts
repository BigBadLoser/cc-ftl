import type { RoomRecipe } from './types';

/**
 * Bridge: the helm forward, looking out the bow; the weapons and shield consoles in an arc or row behind it, all facing fore.
 * No spare consoles and no battery banks (batteries stand with the reactors).
 */
export const bridge = {
  fill: 0.5,
  arrangements: [
    {
      name: 'arc', weight: 2, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'fore', near: 'module.helm' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'fore', near: 'module.helm' },
        { mod: 'module.mess_table', count: 1, minFloor: 30, centre: 'xy', clear: 1, with: { mod: 'module.chair', n: 2 } },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'row', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', face: 'fore', centre: 'y', clear: 1 },
        { mod: 'module.shieldConsole', count: 'spec', face: 'fore', near: 'module.weaponsConsole' },
        { mod: 'module.storage_locker', count: 'fill', wall: 'any', row: true },
      ],
    },
    {
      name: 'stations', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'port' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'stbd' },
        { mod: 'module.mess_table', count: 1, minFloor: 30, centre: 'xy', clear: 1, rots: [1], with: { mod: 'module.chair', n: 2 } },
        { mod: ['module.storage_locker', 'module.storage_rack'], count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
