import type { Vignette } from './types';

/**
 * Islands for roomy rooms (rooms/islands.ts), laid out at rotation 0 (fronts face south). Only working pieces: an island
 * is never set dressing that suggests a mechanic the game does not have (no stand-in consoles).
 */

/** A battery bank: four batteries in a block. */
export const batteryBank: Vignette = { name: 'battery bank', mods: [0, 1].flatMap((x) => [0, 1].map((y) => ({ mod: 'module.battery', x, y }))) };
/** A rack island: two racks back to back, a locker at the end. */
export const rackIsland: Vignette = {
  name: 'rack island', mods: [{ mod: 'module.storage_rack', x: 0, y: 0 }, { mod: 'module.storage_rack', x: 0, y: -1, rot: 2 }, { mod: 'module.storage_locker', x: 2, y: 0 }],
};
