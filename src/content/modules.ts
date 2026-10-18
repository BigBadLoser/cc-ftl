import type { ModuleDef } from '../sim';

/**
 * Ship modules. Power is in units per second (+ supply, - draw). Footprints are [w, h] at
 * rotation 0; `access` is the tile (offset from the footprint's top-left) crew stand on. `openTiles` lists
 * footprint tiles (offsets, rotation 0) that stay walkable inside a solid module: a console's chair and the floor
 * beside it. Everything else of a solid module blocks walking.
 * `asset` ids name models in the render asset manifest.
 */
export const modules = {
  'module.reactor': {
    name: 'Reactor',
    asset: 'module.reactor',
    footprint: [2, 2],
    solid: true,
    power: 50,
    priority: 1,
    heatPerSec: 8,
    flammability: 0.1,
    maxHp: 200,
    buildWork: 240,
    cost: [{ item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 10 }],
  },
  'module.lifeSupport': {
    name: 'Life support',
    asset: 'module.life_support',
    footprint: [1, 2],
    solid: true,
    power: -6,
    priority: 1,
    o2PerSec: 3,
    co2ScrubPerSec: 1,
    flammability: 0.2,
    maxHp: 100,
    buildWork: 160,
    cost: [{ item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 6 }],
  },
  // A lamp on a floor tile beside a wall. Not solid: crew walk over it.
  'module.light': {
    name: 'Light',
    asset: 'module.light',
    footprint: [1, 1],
    solid: false,
    power: -1,
    priority: 2,
    light: { radius: 7, level: 230 },
    flammability: 0.1,
    maxHp: 30,
    buildWork: 40,
    cost: [{ item: 'item.metal', count: 1 }, { item: 'item.electronics', count: 1 }],
  },
  'module.bed': {
    name: 'Bed',
    asset: 'module.bed',
    footprint: [1, 2],
    solid: false,
    power: 0,
    flammability: 0.5,
    maxHp: 50,
    buildWork: 80,
    cost: [{ item: 'item.metal', count: 4 }, { item: 'item.polymer', count: 4 }],
    bed: true,
  },
  'module.console': {
    name: 'Console',
    asset: 'module.console',
    footprint: [1, 1],
    solid: true,
    // Crew stand on the tile below (rotation 0).
    access: [0, 1],
    power: -3,
    priority: 4,
    flammability: 0.3,
    maxHp: 60,
    buildWork: 100,
    cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
    workstation: true,
  },
  // Crew work at the access tile (below, at rotation 0). Draws power; crafts recipes with this station.
  'module.fabricator': {
    name: 'Fabricator',
    asset: 'module.fabricator',
    footprint: [2, 1],
    solid: true,
    access: [0, 1],
    power: -4,
    priority: 3,
    flammability: 0.3,
    maxHp: 120,
    buildWork: 160,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 6 }],
    workstation: true,
    crafting: true,
  },
  // A crate. Crew use it from any neighbouring tile; the access tile just keeps one side walkable.
  'module.storage': {
    name: 'Storage crate',
    asset: 'module.storage',
    footprint: [1, 1],
    solid: true,
    access: [0, 1],
    power: 0,
    flammability: 0.2,
    maxHp: 60,
    buildWork: 60,
    cost: [{ item: 'item.metal', count: 6 }],
    storage: { capacity: 8 },
  },

  // --- Combat. Offsets are (x, y) from the footprint's top-left at rotation 0; crew face south at rotation 0. ---
  // Weapons are a floor bay plus a roof turret: the bay sits anywhere under the roof; the turret aims (Weapon.aim).
  // Light weapons 2x2, heavy 3x3.
  'module.burstLaser': {
    name: 'Burst laser', asset: 'module.burst_laser', footprint: [2, 2], solid: true, power: -8, priority: 3,
    flammability: 0.2, maxHp: 80, buildWork: 200, weapon: 'weapon.burstLaser', roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 8 }],
  },
  'module.massDriver': {
    name: 'Mass driver', asset: 'module.mass_driver', footprint: [3, 3], solid: true, power: -12, priority: 3,
    flammability: 0.2, maxHp: 100, buildWork: 260, weapon: 'weapon.massDriver', roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 24 }, { item: 'item.electronics', count: 8 }],
  },
  'module.missileLauncher': {
    name: 'Missile launcher', asset: 'module.missile_launcher', footprint: [3, 3], solid: true, power: -8, priority: 3,
    flammability: 0.3, maxHp: 80, buildWork: 220, weapon: 'weapon.missile', roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 16 }, { item: 'item.electronics', count: 10 }],
  },
  'module.ionCannon': {
    name: 'Ion cannon', asset: 'module.ion_cannon', footprint: [2, 2], solid: true, power: -8, priority: 3,
    flammability: 0.2, maxHp: 80, buildWork: 220, weapon: 'weapon.ion', roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 14 }],
  },
  'module.incendiaryLauncher': {
    name: 'Incendiary launcher', asset: 'module.incendiary_launcher', footprint: [2, 2], solid: true, power: -8, priority: 3,
    flammability: 0.4, maxHp: 80, buildWork: 200, weapon: 'weapon.incendiary', roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 8 }, { item: 'item.polymer', count: 6 }],
  },
  // 4 wide along the hull, 5 deep. At rotation 0 the north row (y = 0) replaces the hull wall (rotate clockwise for
  // east, south, west); the bell protrudes into space beyond it.
  'module.engine': {
    name: 'Engine', asset: 'module.engine', footprint: [4, 5], solid: true, power: -6, priority: 3,
    heatPerSec: 4, flammability: 0.2, maxHp: 160, buildWork: 320, engine: { evasionPerPower: 0.02 }, hullEdge: 'n',
    roofAsset: 'roof.engine',
    cost: [{ item: 'item.metal', count: 24 }, { item: 'item.electronics', count: 8 }],
  },
  // 1 wide, 4 deep, on the hull. Rotation 0: row 0 is the outer door on the hull line (the wall tile becomes a door), rows
  // 1-2 the chamber, row 3 the inner door. Cycles in 4 s, pumping the chamber's air back into the ship.
  'module.airlock': {
    name: 'Airlock', asset: 'module.airlock', footprint: [1, 4], solid: false, power: -2, priority: 2,
    flammability: 0.1, maxHp: 120, buildWork: 200, hullEdge: 'n', airlock: { cycleSec: 4 },
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 6 }],
  },
  // 8 power -> 2 layers, one back every 10 s. Sits anywhere inside the ship.
  'module.shieldGen': {
    name: 'Shield generator', asset: 'module.shield_gen', footprint: [2, 3], solid: true, power: -8, priority: 2,
    flammability: 0.2, maxHp: 100, buildWork: 220, shieldGen: { layersPerPower: 0.25, rechargeSec: 10 },
    roofAsset: 'roof.shield', deploySec: 2,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 12 }],
  },
  'module.shieldGenSmall': {
    name: 'Small shield generator', asset: 'module.shield_gen_small', footprint: [2, 2], solid: true, power: -4, priority: 2,
    flammability: 0.2, maxHp: 70, buildWork: 140, shieldGen: { layersPerPower: 0.25, rechargeSec: 12 },
    roofAsset: 'roof.shield', deploySec: 2,
    cost: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 8 }],
  },
  // Consoles: the chair is a walkable tile inside the footprint; crew sit there to run the ship system in combat.
  // Weapons console 2x2: solid (0,0) (1,0) (0,1); chair (1,1).
  'module.weaponsConsole': {
    name: 'Weapons console', asset: 'module.weapons_console', footprint: [2, 2], solid: true, access: [1, 1],
    openTiles: [[1, 1]], power: -3, priority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true,
    console: 'weapons', cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Shield console 3x2: solid (0,0) (1,0) (2,0) (0,1); chair (1,1) and free floor (2,1). May shrink to 2x2 later.
  'module.shieldConsole': {
    name: 'Shield console', asset: 'module.shield_console', footprint: [3, 2], solid: true, access: [1, 1],
    openTiles: [[1, 1], [2, 1]], power: -3, priority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true,
    console: 'shields', cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Helm 3x2: solid (0,0) (1,0) (2,0) (0,1) (2,1); chair (1,1) between the side panels.
  'module.helm': {
    name: 'Helm', asset: 'module.helm', footprint: [3, 2], solid: true, access: [1, 1], openTiles: [[1, 1]], power: -3,
    priority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true, console: 'helm', bridge: {},
    cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Point defence: floor bay plus roof turret. Works only while the ship has a powered, intact AI core with its mast out.
  'module.pointDefense': {
    name: 'Point defence', asset: 'module.point_defense', footprint: [2, 2], solid: true, power: -5, priority: 3,
    flammability: 0.2, maxHp: 70, buildWork: 180, pointDefense: true, roofAsset: 'roof.weapon', deploySec: 2,
    cost: [{ item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 8 }],
  },
  // Robot fabricator (rogue AI shipyards): builds hostile robots while powered and run by a live AI core. Placeholder
  // art: the crafting fabricator's sprite.
  'module.robotFabricator': {
    name: 'Robot fabricator', asset: 'module.fabricator', footprint: [2, 1], solid: true, access: [0, 1], power: -6,
    priority: 3, flammability: 0.2, maxHp: 140, buildWork: 240,
    robotFabricator: { roles: ['role.robot_worker', 'role.robot_security', 'role.robot_repair'], intervalSec: 30, cap: 4 },
    cost: [{ item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 12 }],
  },
  // Robot bay 1x2: a charging cradle on the anchor tile (the robot stands in it, like a bed), the charger behind it.
  // Home to one robot: recharges and repairs it, and assembles new ones. Placeholder art: the bed sprite.
  'module.robotBay': {
    name: 'Robot bay', asset: 'module.bed', footprint: [1, 2], solid: false, power: -3, priority: 3,
    flammability: 0.2, maxHp: 90, buildWork: 200, robotBay: { chargePerSec: 1.5, repairPerSec: 1 },
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 8 }],
  },
  'module.aiCore': {
    name: 'AI core', asset: 'module.ai_core', footprint: [2, 2], solid: true, power: -4,
    priority: 3, flammability: 0.2, maxHp: 80, buildWork: 240, aiCore: { tier: 1 }, roofAsset: 'roof.ai', deploySec: 2,
    cost: [{ item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 16 }],
  },
  // Shuttle bay 4x5: a big interior landing pad with a launch hatch (no hull contact needed). Walkable; crew board the
  // shuttle at (1, 4), the south edge of the pad. Pod bays (3x3, class 'pod') come later.
  'module.vehicle_bay': {
    name: 'Shuttle bay', asset: 'module.vehicle_bay', footprint: [4, 5], solid: false, access: [1, 4], openTiles: [[1, 4]],
    power: -1, priority: 4, flammability: 0.1, maxHp: 200, buildWork: 400, vehicleBay: { class: 'shuttle' },
    cost: [{ item: 'item.metal', count: 32 }, { item: 'item.electronics', count: 10 }, { item: 'item.polymer', count: 10 }],
  },
} satisfies Record<string, ModuleDef>;
