import type { RoomRecipe } from './types';

/** Bridge: the helm forward, looking out the bow; the other consoles in an arc or row behind it, all facing fore. */
export const bridge = {
  fill: 0.5,
  arrangements: [
    {
      name: 'arc', weight: 2, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'fore', near: 'module.helm' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'fore', near: 'module.helm' },
        { mod: ['module.storage_locker', 'module.battery'], count: 'fill', wall: 'aft', row: true },
      ],
    },
    {
      name: 'row', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', face: 'fore', centre: 'y', clear: 1 },
        { mod: 'module.shieldConsole', count: 'spec', face: 'fore', near: 'module.weaponsConsole' },
        { mod: 'module.storage_locker', count: 'fill', wall: 'long', row: true },
      ],
    },
    {
      name: 'stations', weight: 1, steps: [
        { mod: 'module.helm', count: 'spec', wall: 'fore', face: 'fore', centre: 'y' },
        { mod: 'module.weaponsConsole', count: 'spec', wall: 'port', face: 'port' },
        { mod: 'module.shieldConsole', count: 'spec', wall: 'stbd', face: 'stbd' },
        { mod: ['module.battery', 'module.storage_locker'], count: 'fill', wall: 'any', row: true },
      ],
    },
  ],
} as const satisfies RoomRecipe;
