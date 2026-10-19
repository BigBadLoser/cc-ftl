import type { ShipTemplate } from '../../sim';

/**
 * 30x20. Engines on the east hull, the end nearest the camera, so the bells face the viewer (rot 1: the engine's
 * wall row replaces the hull wall at x = 28, a space column lies beyond it), engine room and reactors behind a bulkhead, a 2-wide corridor along y = 9..10, quarters and
 * the shield room north, cargo and the AI core south, the bridge (consoles) in the nose and the weapon bays
 * south of it. Console chairs are walkable tiles inside the console footprints.
 */
export const starterShip = {
  name: 'Starter ship',
  crew: ['role.engineer', 'role.engineer', 'role.gunner', 'role.pilot', 'role.medic'],
  rows: [
    '..............................',
    '.############################.',
    '.#______#_____#______#______#.',
    '.#______#_____#______#______#.',
    '.#______#_____#______#______#.',
    '.#______#_____#______#______#.',
    '.#______#_____#______#______#.',
    '.#______#_____#______#______#.',
    '.####D#####D#####D####______#.',
    '.#___________________D______#.',
    '.#___________________D______#.',
    '.#___D#####D#####D####______#.',
    '.#______#____#_______#______#.',
    '.#______#____#_______#______#.',
    '.#______#____#_______#______#.',
    '.#______#____#_______#______#.',
    '.#______#____#_______#______#.',
    '.#______#____#_______#______#.',
    '.############################.',
    '..............................',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 / 3 lays them flat (2x1).
  modules: [
    // Engine room: two engines (4 wide along the hull, 5 deep; rot 1 puts the wall row on the east hull), three
    // reactors clear of the doors at (21, 9..10), life support, lights.
    { def: 'module.engine', x: 24, y: 2, rot: 1 },
    { def: 'module.engine', x: 24, y: 14, rot: 1 },
    { def: 'module.reactor', x: 26, y: 7, rot: 0 },
    { def: 'module.reactor', x: 24, y: 7, rot: 0 },
    { def: 'module.reactor', x: 25, y: 11, rot: 0 },
    { def: 'module.lifeSupport', x: 23, y: 7, rot: 0 },
    { def: 'module.light', x: 22, y: 2, rot: 0 },
    { def: 'module.light', x: 22, y: 5, rot: 0 },
    { def: 'module.light', x: 22, y: 13, rot: 0 },
    { def: 'module.light', x: 22, y: 17, rot: 0 },
    { def: 'module.light', x: 27, y: 9, rot: 0 },
    { def: 'module.light', x: 22, y: 10, rot: 0 },
    // Quarters (north-east room): four beds; the door at (17, 8) opens onto the free row y = 7.
    { def: 'module.bed', x: 19, y: 2, rot: 3 },
    { def: 'module.bed', x: 17, y: 2, rot: 3 },
    { def: 'module.bed', x: 19, y: 3, rot: 3 },
    { def: 'module.bed', x: 17, y: 3, rot: 3 },
    { def: 'module.light', x: 15, y: 2, rot: 0 },
    { def: 'module.light', x: 17, y: 7, rot: 0 },
    // Shield room: generator (2x3) beside the north wall; the door at (11, 8) stays clear.
    { def: 'module.shieldGen', x: 11, y: 2, rot: 0 },
    { def: 'module.light', x: 9, y: 2, rot: 0 },
    { def: 'module.light', x: 9, y: 7, rot: 0 },
    // Corridor: life support lies along the north row so the south row stays clear.
    { def: 'module.lifeSupport', x: 15, y: 9, rot: 3 },
    { def: 'module.light', x: 15, y: 10, rot: 0 },
    { def: 'module.light', x: 9, y: 9, rot: 0 },
    { def: 'module.light', x: 6, y: 10, rot: 0 },
    // Bridge (nose, north-west): shield console (chair (6, 3), open floor (7, 3)), weapons console (chair (2, 3)),
    // helm (chair (5, 6), reached from the south), life support along the south wall.
    { def: 'module.shieldConsole', x: 5, y: 2, rot: 0 },
    { def: 'module.weaponsConsole', x: 2, y: 2, rot: 0 },
    { def: 'module.helm', x: 4, y: 5, rot: 0 },
    { def: 'module.lifeSupport', x: 2, y: 7, rot: 3 },
    { def: 'module.light', x: 7, y: 7, rot: 0 },
    { def: 'module.light', x: 2, y: 5, rot: 0 },
    // Weapon bays (nose, south): two burst lasers (2x2), missile launcher (3x3) around the lane x = 5.
    { def: 'module.burstLaser', x: 6, y: 12, rot: 0 },
    { def: 'module.burstLaser', x: 6, y: 15, rot: 0 },
    { def: 'module.missileLauncher', x: 2, y: 12, rot: 0 },
    { def: 'module.lifeSupport', x: 2, y: 16, rot: 3 },
    { def: 'module.light', x: 5, y: 17, rot: 0 },
    { def: 'module.light', x: 5, y: 13, rot: 0 },
    // AI room (south, middle): AI core (2x2); the door at (11, 11) stays clear.
    { def: 'module.aiCore', x: 10, y: 13, rot: 0 },
    // Point defence (2x2) south of the core; the AI core operates it. Lane x = 12 stays clear.
    { def: 'module.pointDefense', x: 10, y: 15, rot: 0 },
    { def: 'module.light', x: 12, y: 17, rot: 0 },
    { def: 'module.light', x: 9, y: 12, rot: 0 },
    // Cargo (south-east room): crates along the south wall (rot 2 puts the access tile north), fabricator by the
    // door lane. The door at (17, 11) opens onto (17, 12) and (18, 12) stays clear: the way round the shuttle bay to its boarding tile (18, 16).
    { def: 'module.fabricator', x: 19, y: 12, rot: 0 },
    {
      def: 'module.storage', x: 20, y: 17, rot: 2,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.storage', x: 19, y: 17, rot: 2, stock: [{ item: 'item.scrap', count: 80 }, { item: 'item.ice', count: 10 }, { item: 'item.missile', count: 8 }] },
    { def: 'module.storage', x: 18, y: 17, rot: 2, stock: [{ item: 'item.rifle', count: 1 }, { item: 'item.sidearm', count: 2 }, { item: 'item.blade', count: 1 }] },
    { def: 'module.light', x: 15, y: 12, rot: 0 },
    { def: 'module.light', x: 14, y: 12, rot: 0 },
    { def: 'module.light', x: 20, y: 15, rot: 0 },
    // Shuttle bay (pit x 14..17, y 13..17, boarding tile (18, 16) east of it) with the ship's shuttle.
    { def: 'module.vehicle_bay', x: 14, y: 13, rot: 0, vehicle: 'vehicle.shuttle' },
    // Docking airlock on the west hull, y = 9..11 (hull tile and outer door (1, 10), collar (0, 10), pod (2, 10), inside tile
    // (3, 10), unloaders at y = 9 and 11 with their keep-out tiles at (4, 9) and (4, 11)). Row y = 11 is open floor there.
    { def: 'module.airlock', x: 1, y: 9, rot: 3 },
  ],
} satisfies ShipTemplate;

export const starterShipId = 'ship.starter';
