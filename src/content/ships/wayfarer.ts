import type { ShipTemplate } from '../../sim';

/**
 * Wayfarer: the balanced starter, a long-hauler's lived-in ship. 34x23 with an asymmetric silhouette: the cockpit nose juts west and
 * low, the crew lounge is a hump on the north side, the quarters and cargo bay hang below the spine, and the east stern steps back into
 * two staggered engine blocks (rot 1: engine wall row on the east hull, bells toward the camera). A 2-wide corridor along y = 10..11 joins
 * everything. Console chairs are walkable tiles inside the console footprints.
 */
export const wayfarerShip = {
  name: 'Wayfarer',
  crew: ['role.engineer', 'role.gunner', 'role.pilot', 'role.medic'],
  rows: [
    '..................................',
    '..................................',
    '..........##########..#########...',
    '..........#________#..#_______#...',
    '..........#________#..#_______#...',
    '.##########________#..#_______#...',
    '.#________#________#..#_______#...',
    '.#________D________#..#_______###.',
    '.#________#________#..#_________#.',
    '.#________####D########_________#.',
    '.#________D___________D_________#.',
    '.#________#___________#_________#.',
    '.############D#####D#############.',
    '..........#______#__________#.....',
    '..........#______#__________#.....',
    '..........#______#__________#.....',
    '..........#______#__________#.....',
    '..........#______#__________#.....',
    '..........#______#__________#.....',
    '..........########__________#.....',
    '.................#__________#.....',
    '.................############.....',
    '..................................',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 / 3 lays them flat (2x1).
  modules: [
    // Engine room (north-east): engines on the east hull (the lower one steps out two tiles), three reactors and life support.
    { def: 'module.engine', x: 26, y: 3, rot: 1 },
    { def: 'module.engine', x: 28, y: 8, rot: 1 },
    { def: 'module.reactor', x: 23, y: 3, rot: 0 },
    { def: 'module.reactor', x: 23, y: 5, rot: 0 },
    { def: 'module.reactor', x: 23, y: 7, rot: 0 },
    { def: 'module.lifeSupport', x: 28, y: 7, rot: 1 },
    { def: 'module.light', x: 25, y: 3, rot: 0 },
    { def: 'module.light', x: 25, y: 7, rot: 0 },
    { def: 'module.light', x: 24, y: 11, rot: 0 },
    { def: 'module.light', x: 27, y: 10, rot: 0 },
    // Cockpit (nose): helm (chair (4, 7)), shield console (chair (8, 7), open floor (9, 7)), weapons console (chair (3, 11)),
    // the ship's one burst laser and life support. The walkway runs along y = 8..9.
    { def: 'module.helm', x: 3, y: 6, rot: 0 },
    { def: 'module.shieldConsole', x: 7, y: 6, rot: 0 },
    { def: 'module.weaponsConsole', x: 3, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 7, y: 10, rot: 0 },
    { def: 'module.lifeSupport', x: 9, y: 8, rot: 0 },
    { def: 'module.light', x: 2, y: 6, rot: 0 },
    { def: 'module.light', x: 2, y: 8, rot: 0 },
    { def: 'module.light', x: 9, y: 11, rot: 0 },
    { def: 'module.light', x: 2, y: 7, rot: 0 },
    // Crew lounge (north hump): galley, a mess table with chairs, a hydroponics bed and lockers.
    { def: 'module.galley', x: 12, y: 3, rot: 0, orders: [{ recipe: 'recipe.ration', mode: 'keep', target: 12 }] },
    { def: 'module.mess_table', x: 14, y: 5, rot: 0 },
    { def: 'module.chair', x: 14, y: 4, rot: 2 },
    { def: 'module.chair', x: 15, y: 4, rot: 2 },
    { def: 'module.chair', x: 14, y: 6, rot: 0 },
    { def: 'module.chair', x: 15, y: 6, rot: 0 },
    { def: 'module.hydroponics', x: 16, y: 3, rot: 0 },
    { def: 'module.storage_locker', x: 18, y: 3, rot: 0 },
    { def: 'module.lifeSupport', x: 18, y: 5, rot: 0 },
    { def: 'module.light', x: 11, y: 3, rot: 0 },
    { def: 'module.light', x: 17, y: 8, rot: 0 },
    { def: 'module.light', x: 11, y: 8, rot: 0 },
    // Corridor lights.
    { def: 'module.light', x: 12, y: 10, rot: 0 },
    { def: 'module.light', x: 20, y: 10, rot: 0 },
    // Quarters: four beds and a two-cot sickbay corner; the door at (13, 12) opens onto (13, 13).
    { def: 'module.bed', x: 11, y: 13, rot: 0 },
    { def: 'module.bed', x: 12, y: 13, rot: 0 },
    { def: 'module.bed', x: 15, y: 13, rot: 0 },
    { def: 'module.bed', x: 16, y: 13, rot: 0 },
    { def: 'module.med_bed', x: 15, y: 16, rot: 0 },
    { def: 'module.med_bed', x: 16, y: 16, rot: 0 },
    { def: 'module.storage_locker', x: 11, y: 18, rot: 2 },
    { def: 'module.storage_locker', x: 12, y: 18, rot: 2 },
    { def: 'module.light', x: 13, y: 16, rot: 0 },
    { def: 'module.light', x: 11, y: 16, rot: 0 },
    // Cargo bay and shuttle bay (pit x 18..21, y 14..18, boarding tile (22, 17)): crates, fabricator, docking airlock on the south hull.
    { def: 'module.vehicle_bay', x: 18, y: 14, rot: 0, vehicle: 'vehicle.shuttle' },
    { def: 'module.fabricator', x: 24, y: 13, rot: 0 },
    { def: 'module.shieldGen', x: 25, y: 15, rot: 0 },
    { def: 'module.lifeSupport', x: 23, y: 15, rot: 0 },
    { def: 'module.airlock', x: 24, y: 18, rot: 2 },
    {
      def: 'module.storage', x: 27, y: 14, rot: 1,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.storage', x: 27, y: 13, rot: 1, stock: [{ item: 'item.scrap', count: 80 }, { item: 'item.ice', count: 10 }, { item: 'item.ration', count: 12 }] },
    { def: 'module.storage', x: 22, y: 20, rot: 2, stock: [{ item: 'item.rifle', count: 1 }, { item: 'item.sidearm', count: 2 }, { item: 'item.blade', count: 1 }, { item: 'item.fuel', count: 16 }, { item: 'item.water', count: 30 }, { item: 'item.oxygen', count: 20 }] },
    { def: 'module.storage', x: 18, y: 20, rot: 2 },
    { def: 'module.storage', x: 19, y: 20, rot: 2 },
    { def: 'module.light', x: 18, y: 13, rot: 0 },
    { def: 'module.light', x: 22, y: 19, rot: 0 },
    { def: 'module.light', x: 27, y: 19, rot: 0 },
    { def: 'module.light', x: 22, y: 14, rot: 0 },
  ],
} satisfies ShipTemplate;

export const wayfarerShipId = 'ship.wayfarer';
