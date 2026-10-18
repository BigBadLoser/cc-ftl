import type { ShipTemplate } from '../../sim';

/**
 * 24x16 hostile raider with the same full-size modules as the player but fewer: one engine (east hull, rot 1, bell toward the camera), two
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
    '.#_____________#______#.',
    '.#_____________#______#.',
    '.#_____________#______#.',
    '.#_____________D______#.',
    '.#_____________#______#.',
    '.#_____________#______#.',
    '.#######D#######______#.',
    '.#_____________#______#.',
    '.#_____________#______#.',
    '.#_____________D______#.',
    '.#_____________#______#.',
    '.#_____________#______#.',
    '.######################.',
    '........................',
  ],
  modules: [
    // Engine room: engine on the east hull, two reactors, life support. Doors at (15, 5) and (15, 11).
    { def: 'module.engine', x: 18, y: 3, rot: 1 },
    { def: 'module.reactor', x: 19, y: 8, rot: 0 },
    { def: 'module.reactor', x: 19, y: 11, rot: 0 },
    { def: 'module.lifeSupport', x: 17, y: 9, rot: 0 },
    { def: 'module.light', x: 16, y: 3, rot: 0 },
    { def: 'module.light', x: 16, y: 12, rot: 0 },
    // Bridge (north): weapons console (chair (12, 3)), helm (chair (8, 3), reached from the south).
    { def: 'module.weaponsConsole', x: 12, y: 2, rot: 0 },
    { def: 'module.helm', x: 7, y: 2, rot: 0 },
    { def: 'module.light', x: 3, y: 2, rot: 0 },
    { def: 'module.light', x: 11, y: 7, rot: 0 },
    { def: 'module.light', x: 3, y: 7, rot: 0 },
    // Weapon deck (south): two light weapons and the small shield generator. The door at (8, 8) stays clear.
    { def: 'module.burstLaser', x: 12, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 9, y: 10, rot: 0 },
    { def: 'module.shieldGenSmall', x: 4, y: 10, rot: 0 },
    { def: 'module.light', x: 7, y: 13, rot: 0 },
    { def: 'module.light', x: 2, y: 13, rot: 0 },
    { def: 'module.light', x: 14, y: 13, rot: 0 },
  ],
} satisfies ShipTemplate;

export const raiderShipId = 'ship.raider';
