import type { ShipTemplate } from '../../sim';

/**
 * 20x14 rogue AI shipyard: the seed of AI-faction derelicts. One hall run by an AI core: a reactor, a robot
 * fabricator (builds more robots while the core is live), one burst laser with its console, a crate of sidearms for
 * the security bot, three robot bays where its robots recharge, and an airlock on the north hull for boarders. No life support: its robot crew does not breathe.
 * Its robots go inert when the core is destroyed, unpowered or hacked; then holding the core captures it.
 */
export const rogueShipyard = {
  name: 'Rogue AI shipyard',
  faction: 'rogue',
  doctrine: 'weapons',
  crew: ['role.robot_security', 'role.robot_worker', 'role.robot_worker'],
  rows: [
    '....................',
    '.##################.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.#________________#.',
    '.##################.',
    '....................',
  ],
  modules: [
    { def: 'module.reactor', x: 2, y: 2, rot: 0 },
    { def: 'module.aiCore', x: 2, y: 7, rot: 0 },
    { def: 'module.robotFabricator', x: 5, y: 2, rot: 0 },
    // Docking airlock on the north hull, x = 8..10: outer door (9, 1), inside tile (9, 3), keep-out tiles (8, 4) and (10, 4).
    { def: 'module.airlock', x: 8, y: 1, rot: 0 },
    { def: 'module.weaponsConsole', x: 12, y: 2, rot: 0 },
    { def: 'module.burstLaser', x: 15, y: 9, rot: 0 },
    { def: 'module.storage', x: 6, y: 10, rot: 0, stock: [{ item: 'item.sidearm', count: 2 }, { item: 'item.parts', count: 10 }] },
    // Robot bays along the west wall south of the core: rogue robots recharge here.
    { def: 'module.robotBay', x: 2, y: 9, rot: 0 },
    { def: 'module.robotBay', x: 3, y: 9, rot: 0 },
    { def: 'module.robotBay', x: 4, y: 9, rot: 0 },
    { def: 'module.light', x: 17, y: 2, rot: 0 },
    { def: 'module.light', x: 2, y: 11, rot: 0 },
    { def: 'module.light', x: 17, y: 11, rot: 0 },
    { def: 'module.light', x: 8, y: 7, rot: 0 },
  ],
} satisfies ShipTemplate;

export const rogueShipyardId = 'ship.rogueShipyard';
