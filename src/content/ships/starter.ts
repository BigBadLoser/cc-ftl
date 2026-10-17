import type { ShipTemplate } from '../../sim';

/** Engine at the back (left), bridge at the nose (right), corridor along the middle. */
export const starterShip = {
  name: 'Starter ship',
  crew: ['role.engineer', 'role.engineer', 'role.gunner', 'role.pilot', 'role.medic'],
  rows: [
    '########..............',
    '#______#########......',
    '#______#____#__#......',
    '#______#____#__######.',
    '#______#____#__#____#.',
    '#______##D###D##_____#',
    '#______D_______D_____#',
    '#______#_______#_____#',
    '#______##D###D##_____#',
    '#______#____#__#____#.',
    '#______#____#__######.',
    '#______#____#__#......',
    '#______#########......',
    '########..............',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 lays them flat (2x1).
  modules: [
    // Engine room: reactor mid-room (clear of the door at (7, 6)), life support on the west wall.
    { def: 'module.reactor', x: 3, y: 5, rot: 0 },
    { def: 'module.reactor', x: 3, y: 8, rot: 0 },
    // Engines on the west hull.
    { def: 'module.engine', x: 1, y: 8, rot: 0 },
    { def: 'module.engine', x: 1, y: 10, rot: 0 },
    { def: 'module.lifeSupport', x: 1, y: 2, rot: 0 },
    { def: 'module.light', x: 6, y: 2, rot: 0 },
    { def: 'module.light', x: 6, y: 10, rot: 0 },
    // Quarters (top-left room): four beds, door tile (9, 5) opens onto the free row y = 4.
    { def: 'module.bed', x: 8, y: 2, rot: 1 },
    { def: 'module.bed', x: 10, y: 2, rot: 1 },
    { def: 'module.bed', x: 8, y: 3, rot: 1 },
    { def: 'module.bed', x: 10, y: 3, rot: 1 },
    { def: 'module.light', x: 11, y: 4, rot: 0 },
    // Small rooms.
    { def: 'module.light', x: 14, y: 4, rot: 0 },
    { def: 'module.light', x: 11, y: 11, rot: 0 },
    { def: 'module.light', x: 14, y: 11, rot: 0 },
    // Corridor: life support lies along the north row so the south row stays clear.
    { def: 'module.lifeSupport', x: 10, y: 6, rot: 1 },
    { def: 'module.light', x: 14, y: 7, rot: 0 },
    // Bridge: weapons console, helm and shield console on the north wall (crew stand south of them), weapons on
    // the east hull, life support along the south wall.
    { def: 'module.weaponsConsole', x: 17, y: 4, rot: 0 },
    { def: 'module.helm', x: 18, y: 4, rot: 0 },
    { def: 'module.shieldConsole', x: 19, y: 4, rot: 0 },
    { def: 'module.burstLaser', x: 20, y: 5, rot: 0 },
    { def: 'module.missileLauncher', x: 20, y: 7, rot: 0 },
    { def: 'module.lifeSupport', x: 18, y: 9, rot: 1 },
    // Small side rooms: shield generator (north), AI core (south).
    { def: 'module.shieldGen', x: 13, y: 2, rot: 0 },
    { def: 'module.aiCore', x: 13, y: 10, rot: 0 },
    { def: 'module.light', x: 16, y: 4, rot: 0 },
    // Cargo (bottom-left room): crates along the south wall (rot 2 puts the access tile north), fabricator
    // beside the door lane. The door at (9, 8) opens onto (9, 9), which stays clear.
    { def: 'module.fabricator', x: 10, y: 9, rot: 0 },
    {
      def: 'module.storage', x: 8, y: 11, rot: 2,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.storage', x: 9, y: 11, rot: 2, stock: [{ item: 'item.scrap', count: 80 }, { item: 'item.ice', count: 10 }, { item: 'item.missile', count: 8 }] },
    { def: 'module.storage', x: 10, y: 11, rot: 2 },
  ],
} satisfies ShipTemplate;

export const starterShipId = 'ship.starter';
