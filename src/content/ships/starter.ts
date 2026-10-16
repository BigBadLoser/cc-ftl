import type { ShipTemplate } from '../../sim';

/** Engine at the back (left), bridge at the nose (right), corridor along the middle. */
export const starterShip = {
  name: 'Starter ship',
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
    // Bridge: console on the north wall (crew stand south of it), life support on the east wall.
    { def: 'module.console', x: 18, y: 4, rot: 0 },
    { def: 'module.lifeSupport', x: 20, y: 6, rot: 0 },
    { def: 'module.light', x: 16, y: 4, rot: 0 },
  ],
} satisfies ShipTemplate;

export const starterShipId = 'ship.starter';
