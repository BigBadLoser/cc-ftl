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
    // Bridge (north): weapons console (chair (11, 3)), helm (chair (15, 3), reached from the south).
    { def: 'module.weaponsConsole', x: 10, y: 2, rot: 0 },
    { def: 'module.helm', x: 14, y: 2, rot: 0 },
    { def: 'module.light', x: 20, y: 2, rot: 0 },
    { def: 'module.light', x: 12, y: 7, rot: 0 },
    { def: 'module.light', x: 21, y: 7, rot: 0 },
    // Weapon deck (south): two light weapons and the small shield generator. The door at (15, 8) stays clear.
    { def: 'module.burstLaser', x: 10, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 13, y: 10, rot: 0 },
    { def: 'module.shieldGenSmall', x: 18, y: 10, rot: 0 },
    { def: 'module.light', x: 16, y: 13, rot: 0 },
    { def: 'module.light', x: 21, y: 13, rot: 0 },
    { def: 'module.light', x: 9, y: 13, rot: 0 },
    // Shuttle bay in the bridge room (pad x 17..20, y 3..7, boarding tile (18, 7)) with its shuttle.
    { def: 'module.vehicle_bay', x: 17, y: 3, rot: 0, vehicle: 'vehicle.shuttle' },
    // Airlock on the east hull, weapon deck (outer door (22, 12), inside tile (18, 12)).
    { def: 'module.airlock', x: 19, y: 12, rot: 1 },
  ],
} satisfies ShipTemplate;

export const raiderShipId = 'ship.raider';

/**
 * The raider with the boarding doctrine switched on: after 90 s of combat (or sooner when fewer than half its weapons
 * work or its integrity is under 0.6) it sends 2 crew by shuttle to a player airlock. The plain raider never boards, so
 * the balance scenarios stay comparable.
 */
export const raiderBoarder = {
  ...raiderShip,
  name: 'Raider (boarders)',
  boarding: { party: 2, afterSec: 90, losingBelow: 0.6, weapon: 'item.sidearm' },
} satisfies ShipTemplate;

export const raiderBoarderId = 'ship.raiderBoarder';
