import type { RoomRecipe } from './types';

/** Bridge: the helm forward, looking out the bow; the other consoles in an arc or row behind it, all facing fore. */
export const bridge = {
  fill: 0.5,
  arrangements: [
    {
      name: 'arc', weight: 2, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'fore', near: 'module.helm' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'fore', near: 'module.helm' },
        { mod: 'module.console', count: 2, face: 'fore', toward: 'fore', near: 'module.helm' },
        { mod: 'module.battery', count: 1, wall: 'any' },
        { mod: 'module.storage_locker', count: 1, wall: 'any' },
      ],
    },
    {
      name: 'row', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', face: 'fore', centre: 'y', clear: 1 },
        { mod: 'module.shieldConsole', count: 'spec', face: 'fore', near: 'module.weaponsConsole' },
        { mod: 'module.console', count: 3, face: 'fore', row: true, near: 'module.weaponsConsole' },
        { mod: 'module.storage_locker', count: 2, wall: 'any', row: true },
      ],
    },
    {
      name: 'stations', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', wall2: 'any', toward: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'port' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'stbd' },
        { mod: 'module.console', count: 4, wall: 'long', row: true },
        { mod: 'module.battery', count: 1, wall: 'any' },
        { mod: ['module.storage_locker', 'module.storage_rack'], count: 2, wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
