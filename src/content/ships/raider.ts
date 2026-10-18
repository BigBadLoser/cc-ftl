import type { ShipTemplate } from '../../sim';

/**
 * 24x16 hostile raider with the same full-size modules as the player but fewer: one engine (west hull, rot 3), two
 * light weapons, a small shield generator (one layer), a helm and a weapons console, 3 crew.
 */
export const raiderShip = {
  name: 'Raider',
  faction: 'hostile',
  doctrine: 'random',
  crew: ['role.gunner', 'role.pilot', 'role.engineer'],
  rows: [
    '........................',
    '.######################.',
    '.#______#_____________#.',
    '.#______#_____________#.',
    '.#______#_____________#.',
    '.#______D_____________#.',
    '.#______#_____________#.',
    '.#______#_____________#.',
    '.#______#######D#######.',
    '.#______#_____________#.',
    '.#______#_____________#.',
    '.#______D_____________#.',
    '.#______#_____________#.',
    '.#______#_____________#.',
    '.######################.',
    '........................',
  ],
  modules: [
    // Engine room: engine on the west hull, two reactors, life support. Doors at (8, 5) and (8, 11).
    { def: 'module.engine', x: 1, y: 3, rot: 3 },
    { def: 'module.reactor', x: 3, y: 8, rot: 0 },
    { def: 'module.reactor', x: 3, y: 11, rot: 0 },
    { def: 'module.lifeSupport', x: 6, y: 9, rot: 0 },
    { def: 'module.light', x: 7, y: 3, rot: 0 },
    { def: 'module.light', x: 7, y: 12, rot: 0 },
    // Bridge (north): weapons console (chair (10, 3)), helm (chair (15, 3), reached from the south).
    { def: 'module.weaponsConsole', x: 10, y: 2, rot: 0 },
    { def: 'module.helm', x: 14, y: 2, rot: 0 },
    { def: 'module.light', x: 20, y: 2, rot: 0 },
    { def: 'module.light', x: 12, y: 7, rot: 0 },
    { def: 'module.light', x: 20, y: 7, rot: 0 },
    // Weapon deck (south): two light weapons and the small shield generator. The door at (15, 8) stays clear.
    { def: 'module.burstLaser', x: 10, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 13, y: 10, rot: 0 },
    { def: 'module.shieldGenSmall', x: 18, y: 10, rot: 0 },
    { def: 'module.light', x: 16, y: 13, rot: 0 },
    { def: 'module.light', x: 21, y: 13, rot: 0 },
    { def: 'module.light', x: 9, y: 13, rot: 0 },
  ],
} satisfies ShipTemplate;

export const raiderShipId = 'ship.raider';
