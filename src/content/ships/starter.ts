import type { ShipTemplate } from '../../sim';

/**
 * 30x20. Engines on the west hull (rot 3: the engine's wall row replaces the hull wall at x = 1, a space column
 * lies beyond it), engine room and reactors behind a bulkhead, a 2-wide corridor along y = 9..10, quarters and
 * the shield room north, cargo and the AI core south, the bridge (consoles) in the nose and the weapon bays
 * south of it. Console chairs are walkable tiles inside the console footprints.
 */
export const starterShip = {
  name: 'Starter ship',
  crew: ['role.engineer', 'role.engineer', 'role.gunner', 'role.pilot', 'role.medic'],
  rows: [
    '..............................',
    '.############################.',
    '.#______#______#_____#______#.',
    '.#______#______#_____#______#.',
    '.#______#______#_____#______#.',
    '.#______#______#_____#______#.',
    '.#______#______#_____#______#.',
    '.#______#______#_____#______#.',
    '.#______###D######D#####D####.',
    '.#______D___________________#.',
    '.#______D___________________#.',
    '.#______####D#####D#####D####.',
    '.#______#_______#____#______#.',
    '.#______#_______#____#______#.',
    '.#______#_______#____#______#.',
    '.#______#_______#____#______#.',
    '.#______#_______#____#______#.',
    '.#______#_______#____#______#.',
    '.############################.',
    '..............................',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 lays them flat (2x1).
  modules: [
    // Engine room: two engines (4 wide along the hull, 5 deep; rot 3 puts the wall row on the west hull), three
    // reactors clear of the doors at (8, 9..10), life support, lights.
    { def: 'module.engine', x: 1, y: 2, rot: 3 },
    { def: 'module.engine', x: 1, y: 14, rot: 3 },
    { def: 'module.reactor', x: 2, y: 7, rot: 0 },
    { def: 'module.reactor', x: 4, y: 7, rot: 0 },
    { def: 'module.reactor', x: 3, y: 11, rot: 0 },
    { def: 'module.lifeSupport', x: 6, y: 7, rot: 0 },
    { def: 'module.light', x: 7, y: 2, rot: 0 },
    { def: 'module.light', x: 7, y: 5, rot: 0 },
    { def: 'module.light', x: 7, y: 13, rot: 0 },
    { def: 'module.light', x: 7, y: 17, rot: 0 },
    { def: 'module.light', x: 2, y: 9, rot: 0 },
    { def: 'module.light', x: 7, y: 10, rot: 0 },
    // Quarters (north-west room): four beds; the door at (11, 8) opens onto the free row y = 7.
    { def: 'module.bed', x: 9, y: 2, rot: 1 },
    { def: 'module.bed', x: 11, y: 2, rot: 1 },
    { def: 'module.bed', x: 9, y: 3, rot: 1 },
    { def: 'module.bed', x: 11, y: 3, rot: 1 },
    { def: 'module.light', x: 14, y: 2, rot: 0 },
    { def: 'module.light', x: 12, y: 7, rot: 0 },
    // Shield room: generator (2x3) beside the north wall; the door at (18, 8) stays clear.
    { def: 'module.shieldGen', x: 17, y: 2, rot: 0 },
    { def: 'module.light', x: 20, y: 2, rot: 0 },
    { def: 'module.light', x: 20, y: 7, rot: 0 },
    // Corridor: life support lies along the north row so the south row stays clear.
    { def: 'module.lifeSupport', x: 13, y: 9, rot: 1 },
    { def: 'module.light', x: 14, y: 10, rot: 0 },
    { def: 'module.light', x: 20, y: 9, rot: 0 },
    { def: 'module.light', x: 26, y: 10, rot: 0 },
    // Bridge (nose, north): shield console (chair (23, 3), open floor (24, 3)), weapons console (chair (27, 3)),
    // helm (chair (24, 6), reached from the south), life support along the south wall.
    { def: 'module.shieldConsole', x: 22, y: 2, rot: 0 },
    { def: 'module.weaponsConsole', x: 26, y: 2, rot: 0 },
    { def: 'module.helm', x: 23, y: 5, rot: 0 },
    { def: 'module.lifeSupport', x: 26, y: 7, rot: 1 },
    { def: 'module.light', x: 22, y: 7, rot: 0 },
    { def: 'module.light', x: 27, y: 5, rot: 0 },
    // Weapon bays (nose, south): two burst lasers (2x2), missile launcher (3x3) around the lane x = 24.
    { def: 'module.burstLaser', x: 22, y: 12, rot: 0 },
    { def: 'module.burstLaser', x: 22, y: 15, rot: 0 },
    { def: 'module.missileLauncher', x: 25, y: 12, rot: 0 },
    { def: 'module.lifeSupport', x: 26, y: 16, rot: 1 },
    { def: 'module.light', x: 24, y: 17, rot: 0 },
    { def: 'module.light', x: 24, y: 13, rot: 0 },
    // AI room (south, middle): AI core (2x2); the door at (18, 11) stays clear.
    { def: 'module.aiCore', x: 18, y: 13, rot: 0 },
    // Point defence (2x2) south of the core; the AI core operates it. Lane x = 17 stays clear.
    { def: 'module.pointDefense', x: 18, y: 15, rot: 0 },
    { def: 'module.light', x: 17, y: 17, rot: 0 },
    { def: 'module.light', x: 20, y: 12, rot: 0 },
    // Cargo (south-west room): crates along the south wall (rot 2 puts the access tile north), fabricator by the
    // door lane. The door at (12, 11) opens onto (12, 12), which stays clear.
    { def: 'module.fabricator', x: 10, y: 12, rot: 0 },
    {
      def: 'module.storage', x: 9, y: 17, rot: 2,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.storage', x: 10, y: 17, rot: 2, stock: [{ item: 'item.scrap', count: 80 }, { item: 'item.ice', count: 10 }, { item: 'item.missile', count: 8 }] },
    { def: 'module.storage', x: 11, y: 17, rot: 2 },
    { def: 'module.light', x: 14, y: 12, rot: 0 },
    { def: 'module.light', x: 15, y: 12, rot: 0 },
    { def: 'module.light', x: 9, y: 15, rot: 0 },
    // Shuttle bay (pad x 12..15, y 13..17, boarding tile (13, 17)) with the ship's shuttle.
    { def: 'module.vehicle_bay', x: 12, y: 13, rot: 0, vehicle: 'vehicle.shuttle' },
    // Airlock on the east hull, corridor row y = 9 (outer door (28, 9), inside tile (24, 9)).
    { def: 'module.airlock', x: 25, y: 9, rot: 1 },
  ],
} satisfies ShipTemplate;

export const starterShipId = 'ship.starter';
