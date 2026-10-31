import type { ShipTemplate } from '../../sim';

/**
 * Lancer: the fighter. 40x20, a dart: a pointed bow bay with the missile launcher in the tip and a burst laser on each flank, then
 * the bridge, the crew deck (with a small hold and the airlock on its south hull) and a wide engine block at the stern, the hull
 * widening room by room. Engines on the east hull (rot 1, bells toward the camera). No shuttle bay. Doors along y = 11. Console
 * chairs are walkable tiles inside the console footprints.
 */
export const lancerShip = {
  name: 'Lancer',
  crew: ['role.gunner', 'role.gunner', 'role.pilot', 'role.engineer'],
  rows: [
    '........................................',
    '........................................',
    '........................................',
    '........................................',
    '..............................########..',
    '..............................#______#..',
    '....................###########______#..',
    '........#############_________#______#..',
    '....#####____#______#_________#______#..',
    '.####________#______#_________#______#..',
    '.#___________#______#_________#______#..',
    '.#___________D______D_________D______#..',
    '.#___________#______#_________#______#..',
    '.####________#______#_________#______#..',
    '....#####____#______#_________#______#..',
    '........#############_________#______#..',
    '....................###########______#..',
    '..............................#______#..',
    '..............................########..',
    '........................................',
  ],
  // rot: quarter turns clockwise. Beds are 1x2, so rot 1 / 3 lays them flat (2x1).
  modules: [
    // Engine block (stern): two engines on the east hull, three reactors, the Mk II shield generator, life support.
    { def: 'module.engine', x: 33, y: 5, rot: 1 },
    { def: 'module.engine', x: 33, y: 14, rot: 1 },
    { def: 'module.reactor', x: 33, y: 9, rot: 0 },
    { def: 'module.reactor', x: 35, y: 9, rot: 0 },
    { def: 'module.reactor', x: 33, y: 11, rot: 0 },
    { def: 'module.shieldGen.mk2', x: 31, y: 5, rot: 0 },
    { def: 'module.lifeSupport', x: 31, y: 14, rot: 0 },
    { def: 'module.light', x: 31, y: 8, rot: 0 },
    { def: 'module.light', x: 36, y: 12, rot: 0 },
    { def: 'module.light', x: 31, y: 13, rot: 0 },
    { def: 'module.light', x: 36, y: 13, rot: 0 },
    // Bow bay: missile launcher in the tip, a burst laser on each flank, a weapons console for each gunner (chairs (9, 10), (9, 13)).
    { def: 'module.missileLauncher', x: 2, y: 10, rot: 0 },
    { def: 'module.burstLaser', x: 6, y: 9, rot: 0 },
    { def: 'module.burstLaser', x: 6, y: 12, rot: 0 },
    { def: 'module.weaponsConsole', x: 9, y: 9, rot: 0 },
    { def: 'module.weaponsConsole', x: 9, y: 12, rot: 0 },
    { def: 'module.lifeSupport', x: 12, y: 13, rot: 0 },
    { def: 'module.light', x: 5, y: 9, rot: 0 },
    { def: 'module.light', x: 5, y: 13, rot: 0 },
    { def: 'module.light', x: 9, y: 8, rot: 0 },
    { def: 'module.light', x: 12, y: 8, rot: 0 },
    { def: 'module.light', x: 9, y: 14, rot: 0 },
    // Bridge: helm (chair (15, 9)), shield console (chair (18, 9), open floor (19, 9)), life support.
    { def: 'module.helm', x: 14, y: 8, rot: 0 },
    { def: 'module.shieldConsole', x: 17, y: 8, rot: 0 },
    { def: 'module.lifeSupport', x: 14, y: 13, rot: 0 },
    { def: 'module.light', x: 19, y: 14, rot: 0 },
    { def: 'module.light', x: 17, y: 12, rot: 0 },
    // Crew deck: four beds, a galley and mess table, a small hold of three crates, life support and the docking airlock (south hull).
    { def: 'module.bed', x: 21, y: 7, rot: 0 },
    { def: 'module.bed', x: 22, y: 7, rot: 0 },
    { def: 'module.bed', x: 24, y: 7, rot: 0 },
    { def: 'module.bed', x: 25, y: 7, rot: 0 },
    { def: 'module.galley', x: 21, y: 14, rot: 0, orders: [{ recipe: 'recipe.ration', mode: 'keep', target: 12 }] },
    { def: 'module.mess_table', x: 22, y: 12, rot: 0 },
    { def: 'module.chair', x: 22, y: 11, rot: 2 },
    { def: 'module.chair', x: 23, y: 11, rot: 2 },
    { def: 'module.chair', x: 22, y: 13, rot: 0 },
    { def: 'module.chair', x: 23, y: 13, rot: 0 },
    { def: 'module.lifeSupport', x: 29, y: 9, rot: 0 },
    { def: 'module.airlock', x: 26, y: 13, rot: 2 },
    {
      def: 'module.storage', x: 27, y: 7, rot: 0,
      stock: [{ item: 'item.metal', count: 60 }, { item: 'item.electronics', count: 20 }, { item: 'item.polymer', count: 20 }],
    },
    { def: 'module.storage', x: 28, y: 7, rot: 0, stock: [{ item: 'item.scrap', count: 60 }, { item: 'item.ice', count: 10 }, { item: 'item.missile', count: 16 }, { item: 'item.ration', count: 12 }] },
    { def: 'module.storage', x: 29, y: 7, rot: 0, stock: [{ item: 'item.rifle', count: 1 }, { item: 'item.sidearm', count: 2 }, { item: 'item.blade', count: 1 }, { item: 'item.fuel', count: 16 }, { item: 'item.water', count: 30 }, { item: 'item.oxygen', count: 20 }] },
    { def: 'module.light', x: 23, y: 8, rot: 0 },
    { def: 'module.light', x: 27, y: 9, rot: 0 },
    { def: 'module.light', x: 21, y: 10, rot: 0 },
    { def: 'module.light', x: 25, y: 11, rot: 0 },
    { def: 'module.light', x: 29, y: 14, rot: 0 },
    { def: 'module.light', x: 24, y: 15, rot: 0 },
  ],
} satisfies ShipTemplate;

export const lancerShipId = 'ship.lancer';
