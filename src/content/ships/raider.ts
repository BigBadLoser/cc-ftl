import type { ShipTemplate } from '../../sim';

/** A small hostile raider: two weapons, one shield layer, a helm and a weapons console, 3 crew. */
export const raiderShip = {
  name: 'Raider',
  faction: 'hostile',
  doctrine: 'weapons',
  crew: ['role.gunner', 'role.pilot', 'role.engineer'],
  rows: [
    '############',
    '#____#_____#',
    '#____#_____#',
    '#____D_____#',
    '#____#_____#',
    '#____#_____#',
    '############',
  ],
  modules: [
    // Engine room: reactor, life support, engine on the west hull.
    { def: 'module.reactor', x: 2, y: 1, rot: 0 },
    { def: 'module.lifeSupport', x: 4, y: 1, rot: 0 },
    { def: 'module.engine', x: 1, y: 4, rot: 0 },
    { def: 'module.light', x: 3, y: 5, rot: 0 },
    // Bridge: consoles on the north wall, weapons on the east hull.
    { def: 'module.shieldGenSmall', x: 6, y: 1, rot: 0 },
    { def: 'module.weaponsConsole', x: 7, y: 1, rot: 0 },
    { def: 'module.helm', x: 8, y: 1, rot: 0 },
    { def: 'module.burstLaser', x: 10, y: 1, rot: 0 },
    { def: 'module.massDriver', x: 10, y: 4, rot: 0 },
    { def: 'module.light', x: 8, y: 5, rot: 0 },
  ],
} satisfies ShipTemplate;

export const raiderShipId = 'ship.raider';
