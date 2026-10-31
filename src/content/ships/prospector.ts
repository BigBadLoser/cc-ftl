import type { ShipTemplate } from '../../sim';

/**
 * Prospector: the hauler and miner. 34x23, cargo first: a big blocky hold (ore bins, freight containers, a pallet, the ore refinery
 * and a pod bay in a bulge on its south-west corner) with a small crew stub in the nose and an engine annex behind it. The engines sit on
 * the east hull (rot 1, bells toward the camera). Console chairs are walkable tiles inside the console footprints.
 */
export const prospectorShip = {
  name: 'Prospector',
  crew: ['role.pilot', 'role.engineer', 'role.engineer'],
  rows: [
    '..................................',
    '..................................',
    '..................................',
    '..........###############.........',
    '..........#_____________########..',
    '..........#_____________#______#..',
    '.##########_____________#______#..',
    '.#________#_____________#______#..',
    '.#________#_____________#______#..',
    '.#________D_____________#______#..',
    '.#________#_____________#______#..',
    '.#________#_____________#______#..',
    '.####D#####_____________D______#..',
    '.#________#_____________#______#..',
    '.#________#_____________#______#..',
    '.#________D_____________#______#..',
    '.#________#_____________#______#..',
    '.#________#_____________########..',
    '.##########_____#########.........',
    '..........#_____#.................',
    '..........#_____#.................',
    '..........#######.................',
    '..................................',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 / 3 lays them flat (2x1).
  modules: [
    // Engine annex (east): two engines on the east hull, two reactors, life support and the shield generator.
    { def: 'module.engine', x: 27, y: 5, rot: 1 },
    { def: 'module.engine', x: 27, y: 13, rot: 1 },
    { def: 'module.reactor', x: 29, y: 9, rot: 0 },
    { def: 'module.reactor', x: 29, y: 11, rot: 0 },
    { def: 'module.lifeSupport', x: 27, y: 9, rot: 0 },
    { def: 'module.shieldGen', x: 25, y: 15, rot: 0 },
    { def: 'module.light', x: 25, y: 5, rot: 0 },
    { def: 'module.light', x: 25, y: 10, rot: 0 },
    { def: 'module.light', x: 25, y: 13, rot: 0 },
    { def: 'module.light', x: 27, y: 12, rot: 0 },
    // Cab (nose): helm (chair (3, 8)), shield console (chair (7, 8), open floor (8, 8)), weapons console (chair (8, 11)),
    // the ship's one burst laser, life support. The walkway runs along y = 9.
    { def: 'module.helm', x: 2, y: 7, rot: 0 },
    { def: 'module.shieldConsole', x: 6, y: 7, rot: 0 },
    { def: 'module.weaponsConsole', x: 8, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 3, y: 10, rot: 0 },
    { def: 'module.lifeSupport', x: 9, y: 7, rot: 0 },
    { def: 'module.light', x: 2, y: 9, rot: 0 },
    { def: 'module.light', x: 6, y: 11, rot: 0 },
    // Crew deck: three beds, the galley (access (7, 14)), a mess table with chairs, lockers.
    { def: 'module.bed', x: 2, y: 16, rot: 0 },
    { def: 'module.bed', x: 3, y: 16, rot: 0 },
    { def: 'module.bed', x: 4, y: 16, rot: 0 },
    { def: 'module.galley', x: 7, y: 13, rot: 0, orders: [{ recipe: 'recipe.ration', mode: 'keep', target: 12 }] },
    { def: 'module.mess_table', x: 7, y: 16, rot: 0 },
    { def: 'module.chair', x: 7, y: 15, rot: 2 },
    { def: 'module.chair', x: 8, y: 15, rot: 2 },
    { def: 'module.chair', x: 7, y: 17, rot: 0 },
    { def: 'module.chair', x: 8, y: 17, rot: 0 },
    { def: 'module.lifeSupport', x: 9, y: 13, rot: 0 },
    { def: 'module.storage_locker', x: 2, y: 13, rot: 0 },
    { def: 'module.storage_locker', x: 3, y: 13, rot: 0 },
    { def: 'module.light', x: 5, y: 13, rot: 0 },
    { def: 'module.light', x: 5, y: 17, rot: 0 },
    { def: 'module.light', x: 9, y: 17, rot: 0 },
    // Hold, north row (y 4..7): the ore refinery (access (14, 7)), ore bins, and the docking airlock on the north hull.
    { def: 'module.refinery', x: 11, y: 4, rot: 0 },
    { def: 'module.storage_ore', x: 15, y: 4, rot: 0 },
    { def: 'module.storage_ore_large', x: 17, y: 4, rot: 0 },
    { def: 'module.airlock', x: 21, y: 3, rot: 0 },
    { def: 'module.lifeSupport', x: 23, y: 8, rot: 0 },
    // Hold, aisle y 8..9 then freight containers (y 10..11 and 14..15, opened from the south) and a pallet. Supplies are in the containers.
    {
      def: 'module.cargo_container', x: 15, y: 10, rot: 0,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.cargo_container', x: 18, y: 10, rot: 0, stock: [{ item: 'item.scrap', count: 80 }, { item: 'item.ice', count: 10 }, { item: 'item.ration', count: 12 }, { item: 'item.fuel', count: 16 }] },
    { def: 'module.cargo_container', x: 21, y: 10, rot: 0, stock: [{ item: 'item.rifle', count: 1 }, { item: 'item.sidearm', count: 2 }, { item: 'item.blade', count: 1 }, { item: 'item.water', count: 30 }, { item: 'item.oxygen', count: 20 }] },
    { def: 'module.storage_pallet', x: 15, y: 14, rot: 0 },
    { def: 'module.cargo_container', x: 17, y: 14, rot: 0 },
    { def: 'module.cargo_container', x: 20, y: 14, rot: 0 },
    { def: 'module.storage', x: 23, y: 15, rot: 0 },
    // Pod bay (pit x 11..13, y 18..20, access (14, 19)) with its mining pod, in the south-west bulge.
    { def: 'module.pod_bay', x: 11, y: 18, rot: 0, vehicle: 'vehicle.mining_pod' },
    { def: 'module.light', x: 11, y: 8, rot: 0 },
    { def: 'module.light', x: 23, y: 12, rot: 0 },
    { def: 'module.light', x: 14, y: 12, rot: 0 },
    { def: 'module.light', x: 14, y: 16, rot: 0 },
    { def: 'module.light', x: 22, y: 17, rot: 0 },
    { def: 'module.light', x: 15, y: 20, rot: 0 },
    { def: 'module.light', x: 19, y: 7, rot: 0 },
  ],
} satisfies ShipTemplate;

export const prospectorShipId = 'ship.prospector';
