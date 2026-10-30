import type { Vignette } from './types';

/** Islands for roomy rooms (rooms/islands.ts), laid out at rotation 0 (fronts face south; chairs turn to their desk). */

const chairs = (xs: readonly number[], y: number) => xs.map((x) => ({ mod: 'module.chair', x, y }));

// Seats go in before their console: a placed console keeps its front tile clear, the seat already on it is its user.
/** A control desk: two consoles side by side, a seat at each. */
export const controlDesk: Vignette = { name: 'control desk', mods: [...chairs([0, 1], 1), { mod: 'module.console', x: 0, y: 0 }, { mod: 'module.console', x: 1, y: 0 }] };
/** A console out on the floor with a seat at it. */
export const consoleSeat: Vignette = { name: 'console seat', mods: [...chairs([0], 1), { mod: 'module.console', x: 0, y: 0 }] };
/** A battery bank: four batteries in a block. */
export const batteryBank: Vignette = { name: 'battery bank', mods: [0, 1].flatMap((x) => [0, 1].map((y) => ({ mod: 'module.battery', x, y }))) };
/** A rack island: two racks back to back, a locker at the end. */
export const rackIsland: Vignette = {
  name: 'rack island', mods: [{ mod: 'module.storage_rack', x: 0, y: 0 }, { mod: 'module.storage_rack', x: 0, y: -1, rot: 2 }, { mod: 'module.storage_locker', x: 2, y: 0 }],
};
