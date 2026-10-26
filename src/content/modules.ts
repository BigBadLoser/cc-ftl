import type { ModuleDef } from '../sim';
import { furniture } from './furniture';

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
    category: 'power',
    description: "Burns fuel rods for the ship's main power. Runs hot, so keep it ventilated.",
    asset: 'module.reactor',
    footprint: [2, 2],
    solid: true,
    power: 50,
    powerPriority: 1,
    heatPerSec: 8,
    flammability: 0.1,
    maxHp: 200,
    buildWork: 240,
    cost: [{ item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 10 }],
  },
  'module.lifeSupport': {
    name: 'Life support',
    category: 'life',
    description: "Makes breathable air and scrubs CO2 for the room it sits in.",
    asset: 'module.life_support',
    footprint: [1, 2],
    solid: true,
    power: -6,
    powerPriority: 1,
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
    category: 'utility',
    description: "A lamp for a floor tile beside a wall. Crew walk right over it.",
    asset: 'module.light',
    footprint: [1, 1],
    solid: false,
    power: -1,
    powerPriority: 2,
    light: { radius: 7, level: 230 },
    flammability: 0.1,
    maxHp: 30,
    buildWork: 40,
    cost: [{ item: 'item.metal', count: 1 }, { item: 'item.electronics', count: 1 }],
  },
  'module.bed': {
    name: 'Bed',
    category: 'life',
    description: "Somewhere for a crew member to sleep and recover rest.",
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
    category: 'systems',
    description: "A general console. Crew sit at it to work.",
    asset: 'module.console',
    footprint: [1, 1],
    solid: true,
    // Crew stand on the tile below (rotation 0).
    access: [0, 1],
    power: -3,
    powerPriority: 4,
    flammability: 0.3,
    maxHp: 60,
    buildWork: 100,
    cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
    workstation: true,
  },
  // The research module: crew work the ship's active research project here (sim/research). No blueprint: known from the start.
  // Placeholder art: the console sprite (docs/STATUS.md). Needs its own model in an art pack.
  'module.research': {
    name: 'Research module',
    category: 'systems',
    description: "Crew study the ship's active research project here, faster with science. A second one speeds the same project up.",
    asset: 'module.console',
    footprint: [1, 1],
    solid: true,
    access: [0, 1],
    power: -4,
    powerPriority: 4,
    flammability: 0.3,
    maxHp: 70,
    buildWork: 120,
    cost: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 6 }],
    workstation: true,
    research: true,
  },
  // Crew work at the access tile (below, at rotation 0). Draws power; crafts recipes with this station.
  'module.fabricator': {
    name: 'Fabricator',
    category: 'production',
    description: "Turns metal, polymer and electronics into parts, tools and gear. Crew work it from the front tile.",
    asset: 'module.fabricator',
    footprint: [2, 1],
    solid: true,
    access: [0, 1],
    power: -4,
    powerPriority: 3,
    flammability: 0.3,
    maxHp: 120,
    buildWork: 160,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 6 }],
    workstation: true,
    crafting: true,
  },
  // Galley / food printer: prints rations from scrap (crafting) and is where hungry crew eat a hot meal (access tile).
  // Placeholder art (fallback.ts): needs a real model, see docs/STATUS.md.
  'module.galley': {
    name: 'Galley',
    category: 'life',
    description: "Prints hot meals. Hungry crew eat at its access tile, which lifts their mood.",
    asset: 'module.galley',
    footprint: [2, 1],
    solid: true,
    access: [0, 1],
    power: -3,
    powerPriority: 4,
    flammability: 0.4,
    maxHp: 90,
    buildWork: 120,
    cost: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 3 }],
    workstation: true,
    crafting: true,
    galley: true,
  },
  // A crate. Crew use it from any neighbouring tile; the access tile just keeps one side walkable.
  'module.storage': {
    name: 'Storage crate',
    category: 'storage',
    description: "A small crate. Crew use it from any neighbouring tile.",
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

  // Sealed cargo containers (sim/containers): solid boxes on Beam tiles clamped to a freighter's frame, no interior.
  // Footprint W x H at rotation 0 (art `container.<W>x<H>`); a storage slot per tile and a bit (capacity, hp and cost scale with the area: 8 and 18 tiles).
  'container.2x4': {
    name: 'Small container',
    category: 'storage',
    description: "A sealed cargo container clamped to the frame. Holds a modest load.",
    asset: 'container.2x4', footprint: [2, 4], solid: true, cover: 'full', power: 0,
    flammability: 0.1, maxHp: 120, buildWork: 320, cost: [{ item: 'item.metal', count: 16 }], storage: { capacity: 9 }, container: true,
  },
  'container.3x6': {
    name: 'Large container',
    category: 'storage',
    description: "A large sealed cargo container clamped to the frame.",
    asset: 'container.3x6', footprint: [3, 6], solid: true, cover: 'full', power: 0,
    flammability: 0.1, maxHp: 190, buildWork: 500, cost: [{ item: 'item.metal', count: 31 }], storage: { capacity: 22 }, container: true,
  },

  // --- Combat. Offsets are (x, y) from the footprint's top-left at rotation 0; crew face south at rotation 0. ---
  // Weapons are a floor bay plus a roof turret: the bay sits anywhere under the roof; the turret aims (Weapon.aim).
  // Light weapons 2x2, heavy 3x3.
  'module.burstLaser': {
    name: 'Burst laser',
    category: 'defence',
    description: "Fast light laser. Fires bursts at a target ship's systems.",
    asset: 'module.burst_laser', footprint: [2, 2], solid: true, power: -8, powerPriority: 3,
    flammability: 0.2, maxHp: 80, buildWork: 200, weapon: 'weapon.burstLaser', deploySec: 2,
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 8 }],
  },
  'module.massDriver': {
    name: 'Mass driver',
    category: 'defence',
    description: "Heavy kinetic gun. Slow to reload and hard to stop.",
    asset: 'module.mass_driver', footprint: [3, 3], solid: true, power: -12, powerPriority: 3,
    flammability: 0.2, maxHp: 100, buildWork: 260, weapon: 'weapon.massDriver', deploySec: 2,
    cost: [{ item: 'item.metal', count: 24 }, { item: 'item.electronics', count: 8 }],
  },
  'module.missileLauncher': {
    name: 'Missile launcher',
    category: 'defence',
    description: "Heavy launcher for guided missiles that point defence can shoot down.",
    asset: 'module.missile_launcher', footprint: [3, 3], solid: true, power: -8, powerPriority: 3,
    flammability: 0.3, maxHp: 80, buildWork: 220, weapon: 'weapon.missile', deploySec: 2,
    cost: [{ item: 'item.metal', count: 16 }, { item: 'item.electronics', count: 10 }],
  },
  'module.ionCannon': {
    name: 'Ion cannon',
    category: 'defence',
    description: "Disables systems with ion charges instead of destroying them.",
    asset: 'module.ion_cannon', footprint: [2, 2], solid: true, power: -8, powerPriority: 3,
    flammability: 0.2, maxHp: 80, buildWork: 220, weapon: 'weapon.ion', deploySec: 2,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 14 }],
  },
  'module.incendiaryLauncher': {
    name: 'Incendiary launcher',
    category: 'defence',
    description: "Throws incendiary rounds that start fires aboard the target.",
    asset: 'module.incendiary_launcher', footprint: [2, 2], solid: true, power: -8, powerPriority: 3,
    flammability: 0.4, maxHp: 80, buildWork: 200, weapon: 'weapon.incendiary', deploySec: 2,
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 8 }, { item: 'item.polymer', count: 6 }],
  },
  // 4 wide along the hull, 5 deep. At rotation 0 the north row (y = 0) replaces the hull wall (rotate clockwise for
  // east, south, west); the bell protrudes into space beyond it.
  'module.engine': {
    name: 'Engine',
    category: 'systems',
    description: "Pushes the ship and adds evasion in a fight. Needs a pilot. Sits on the hull edge.",
    asset: 'module.engine', footprint: [4, 5], solid: true, power: -6, powerPriority: 3,
    heatPerSec: 4, flammability: 0.2, maxHp: 160, buildWork: 320, engine: { evasionPerPower: 0.02 }, hullEdge: 'n',
    cost: [{ item: 'item.metal', count: 24 }, { item: 'item.electronics', count: 8 }],
  },
  // Docking airlock, 3 wide along the hull, hull row plus 3 inboard (footprint [3, 4], hullEdge 'n'; art: airlock family in
  // tools/blender/sprites/airlock.py). Rotation 0 (cols 0-2, rows 0-3, row 0 on the hull line):
  //   row -1  (1,-1)      docking collar, outside the footprint, one tile past the hull (the shuttle's rear ramp meets it)
  //   row 0   (1,0)       hull tile with the outer door (the collar's iris hatch); (0,0) and (2,0) stay plain hull wall
  //   row 1   (1,1)       the pod, the inner door;  (0,1) (2,1) unloader back halves
  //   row 2   (1,2)       inside tile, walkable: where passengers land;  (0,2) (2,2) unloader fronts, the chutes
  //   row 3   (1,3)       walkable;  (0,3) (2,3) keep-out tiles: walkable, where crew work the chutes, nothing else builds here
  // Cycles in 4 s, pumping the outer door tile's air back into the ship. Holds 3 EVA suits (crew put one on at the inside tile).
  'module.airlock': {
    name: 'Airlock',
    category: 'structure',
    description: "Cycles crew between the ship and open space or a docked craft. Replaces a stretch of hull.",
    asset: 'module.airlock', footprint: [3, 4], solid: true,
    openTiles: [[1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [2, 3]],
    power: -2, powerPriority: 2, flammability: 0.1, maxHp: 120, buildWork: 200, hullEdge: 'n',
    airlock: {
      cycleSec: 4,
      suits: 3,
      layout: {
        outer: [1, 0], inner: [1, 1], inside: [1, 2], collar: [1, -1],
        unloaders: [
          { tiles: [[0, 1], [0, 2]], chute: [0, 2], stand: [0, 3] },
          { tiles: [[2, 1], [2, 2]], chute: [2, 2], stand: [2, 3] },
        ],
      },
    },
    cost: [{ item: 'item.metal', count: 14 }, { item: 'item.electronics', count: 6 }],
  },
  // 8 power -> 2 layers, one back every 10 s. Sits anywhere inside the ship.
  'module.shieldGen': {
    name: 'Shield generator',
    category: 'defence',
    description: "Projects shield layers that absorb incoming shots and recharge over time.",
    asset: 'module.shield_gen', footprint: [2, 3], solid: true, power: -8, powerPriority: 2,
    flammability: 0.2, maxHp: 100, buildWork: 220, shieldGen: { layersPerPower: 0.25, rechargeSec: 10 },
    roofAsset: 'roof.shield_gen', deploySec: 2,
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 12 }],
  },
  'module.shieldGenSmall': {
    name: 'Small shield gen',
    category: 'defence',
    description: "A compact shield generator. Fewer layers for less power.",
    asset: 'module.shield_gen_small', footprint: [2, 2], solid: true, power: -4, powerPriority: 2,
    flammability: 0.2, maxHp: 70, buildWork: 140, shieldGen: { layersPerPower: 0.25, rechargeSec: 12 },
    roofAsset: 'roof.shield_gen_small', deploySec: 2,
    cost: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 8 }],
  },
  // Consoles: the chair is a walkable tile inside the footprint; crew sit there to run the ship system in combat.
  // Footprints, chairs and open tiles match the approved art (tools/blender/sprites/consoles.py meta()).
  // Weapons console 2x2: desk (0,0) (1,0) and the right-hand bar (1,1); chair (0,1) in the U, the flight-stick pod on its left.
  'module.weaponsConsole': {
    name: 'Weapons console',
    category: 'systems',
    description: "Crew at this console run the ship's weapons in combat.",
    asset: 'module.weapons_console', footprint: [2, 2], solid: true, access: [0, 1],
    openTiles: [[0, 1]], power: -3, powerPriority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true,
    console: 'weapons', cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Shield console 3x2: solid (0,0) (1,0) (2,0) (0,1); chair (1,1) and free floor (2,1). May shrink to 2x2 later.
  'module.shieldConsole': {
    name: 'Shield console',
    category: 'systems',
    description: "Crew at this console run the ship's shields in combat.",
    asset: 'module.shield_console', footprint: [3, 2], solid: true, access: [1, 1],
    openTiles: [[1, 1], [2, 1]], power: -3, powerPriority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true,
    console: 'shields', cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Helm 3x2: solid (0,0) (1,0) (2,0) (0,1) (2,1); chair (1,1) between the side panels.
  'module.helm': {
    name: 'Helm',
    category: 'systems',
    description: "The pilot's seat. Steers the ship and holds the bridge.",
    asset: 'module.helm', footprint: [3, 2], solid: true, access: [1, 1], openTiles: [[1, 1]], power: -3,
    powerPriority: 4, flammability: 0.3, maxHp: 60, buildWork: 100, workstation: true, console: 'helm', bridge: {},
    cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // Point defence: floor bay plus roof turret. Works only while the ship has a powered, intact AI core with its mast out.
  'module.pointDefense': {
    name: 'Point defence',
    category: 'defence',
    description: "Shoots down incoming missiles. Needs a working AI core.",
    asset: 'module.point_defense', footprint: [2, 2], solid: true, power: -5, powerPriority: 3,
    flammability: 0.2, maxHp: 70, buildWork: 180, pointDefense: true, deploySec: 2,
    cost: [{ item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 8 }],
  },
  // Robot fabricator (rogue AI shipyards): builds hostile robots while powered and run by a live AI core. Placeholder
  // art: the crafting fabricator's sprite.
  'module.robotFabricator': {
    name: 'Robot fabricator',
    category: 'production',
    description: "Builds robots for the ship, a few at a time. Needs an AI core.",
    asset: 'module.fabricator', footprint: [2, 1], solid: true, access: [0, 1], power: -6,
    powerPriority: 3, flammability: 0.2, maxHp: 140, buildWork: 240,
    robotFabricator: { roles: ['role.robot_worker', 'role.robot_security', 'role.robot_repair'], intervalSec: 30, cap: 4 },
    cost: [{ item: 'item.metal', count: 20 }, { item: 'item.electronics', count: 12 }],
  },
  // Robot bay 1x2: a charging cradle on the anchor tile (the robot stands in it, like a bed), the charger behind it.
  // Home to one robot: recharges and repairs it, and assembles new ones. The tower (local row 1) is solid; the cradle (row 0) is walkable.
  'module.robotBay': {
    name: 'Robot bay',
    category: 'utility',
    description: "A charging cradle that recharges and repairs one robot.",
    asset: 'module.robot_bay', footprint: [1, 2], solid: true, access: [0, 0], openTiles: [[0, 0]], power: -3, powerPriority: 3,
    flammability: 0.2, maxHp: 90, buildWork: 200, robotBay: { chargePerSec: 1.5, repairPerSec: 1 },
    cost: [{ item: 'item.metal', count: 12 }, { item: 'item.electronics', count: 8 }],
  },
  'module.aiCore': {
    name: 'AI core',
    category: 'systems',
    description: "Runs ship automation such as point defence.",
    asset: 'module.ai_core', footprint: [2, 2], solid: true, power: -4,
    powerPriority: 3, flammability: 0.2, maxHp: 80, buildWork: 240, aiCore: { tier: 1 }, roofAsset: 'roof.ai_core', deploySec: 2,
    cost: [{ item: 'item.metal', count: 10 }, { item: 'item.electronics', count: 16 }],
  },
  // Shuttle bay 4x5: the whole footprint is a deep pit the shuttle hangs in (solid, nothing walkable inside). Crew board from
  // the normal floor beside the long side: the access tile is outside the footprint, east of the pit in the hatch row
  // (rotation 0: tile (4, 3)), and turns with the module. Pod bays (3x3, class 'pod') come later.
  'module.vehicle_bay': {
    name: 'Shuttle bay',
    category: 'utility',
    description: "A pit that holds one shuttle and launches it through hatch doors.",
    asset: 'module.vehicle_bay', footprint: [4, 5], solid: true, access: [4, 3],
    power: -1, powerPriority: 4, flammability: 0.1, maxHp: 200, buildWork: 400, vehicleBay: { class: 'shuttle' },
    cost: [{ item: 'item.metal', count: 32 }, { item: 'item.electronics', count: 10 }, { item: 'item.polymer', count: 10 }],
  },
  // Small 3x3 bay for one pod (class 'pod'), placed like the shuttle bay: solid pit, crew unload it at the access tile beside
  // the middle of its east side.
  'module.pod_bay': {
    name: 'Pod bay',
    category: 'utility',
    description: "A pit for one mining or construction pod.",
    asset: 'module.pod_bay', footprint: [3, 3], solid: true, access: [3, 1],
    // Built by crew, it comes with its pod: the cost covers both (bay 16 metal, 6 electronics; pod 12 metal, 6 electronics,
    // 4 polymer).
    power: -1, powerPriority: 4, flammability: 0.1, maxHp: 120, buildWork: 360, vehicleBay: { class: 'pod', builtWith: 'vehicle.mining_pod' },
    cost: [{ item: 'item.metal', count: 28 }, { item: 'item.electronics', count: 12 }, { item: 'item.polymer', count: 4 }],
  },
  ...furniture,
} satisfies Record<string, ModuleDef>;
