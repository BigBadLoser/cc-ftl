import type { ModuleDef } from '../sim';

/**
 * Room furniture the ship generator's room recipes lay out (src/sim/shipgen/rooms). Mess tables and chairs have art
 * (the food pack); the rest are planned modules with no art yet, drawn by the fallback until their sheets exist.
 * None of them adds a mechanic: storage holds items like a crate, the others are dressing (no sit-to-eat yet).
 */
/** What an ore bin's sprite shows for each ore (art kind of `module.storage_ore.<kind>.<fill>`). */
const ORE_ART = { 'item.iron_ore': 'iron', 'item.ice': 'ice', 'item.rare_ore': 'rare' };

/** Scrap cages hold only scrap. Their sprite has no per-kind variants (art kind '': `module.storage_scrap.<fill>`). */
const SCRAP_IDS = ['item.scrap_hull', 'item.scrap_tech', 'item.scrap_energy', 'item.scrap_weapons', 'item.scrap_comfort'];
const SCRAP_ART = Object.fromEntries(SCRAP_IDS.map((i) => [i, '']));

export const furniture = {
  // 2x1 table; crew sit on chairs beside its long sides. Not in the sim yet: eating at a table.
  'module.mess_table': {
    name: 'Mess table',
    category: 'life',
    description: "A table for the mess. Crew sit on chairs beside it.",
    asset: 'module.mess_table', footprint: [2, 1], solid: true, power: 0, flammability: 0.3,
    maxHp: 50, buildWork: 60, cost: [{ item: 'item.metal', count: 4 }, { item: 'item.polymer', count: 2 }],
  },
  // A seat (walkable). A seated crew member faces r0 -y, r1 +x, r2 +y, r3 -x.
  'module.chair': {
    name: 'Chair',
    category: 'life',
    description: "A seat. Walkable.",
    asset: 'module.chair', footprint: [1, 1], solid: false, power: 0, flammability: 0.4,
    maxHp: 30, buildWork: 30, cost: [{ item: 'item.metal', count: 2 }, { item: 'item.polymer', count: 1 }],
  },
  'module.storage_locker': {
    name: 'Locker',
    category: 'storage',
    description: "A tall locker. Opens to its front side.",
    asset: 'module.storage_locker', footprint: [1, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.2, maxHp: 50, buildWork: 50, cost: [{ item: 'item.metal', count: 4 }], storage: { capacity: 4 },
  },
  // Shelving along an aisle, worked from its front (access) side.
  'module.storage_rack': {
    name: 'Storage rack',
    category: 'storage',
    description: "Shelving along an aisle, worked from its front side.",
    asset: 'module.storage_rack', footprint: [2, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.2, maxHp: 80, buildWork: 90, cost: [{ item: 'item.metal', count: 10 }], storage: { capacity: 16 },
  },
  'module.storage_pallet': {
    name: 'Cargo pallet',
    category: 'storage',
    description: "An open cargo pallet. Holds a lot for its size.",
    asset: 'module.storage_pallet', footprint: [2, 2], solid: true, access: [0, 2], power: 0,
    flammability: 0.3, maxHp: 100, buildWork: 80, cost: [{ item: 'item.metal', count: 8 }], storage: { capacity: 24 },
  },
  // Ore tip bins (art: storage_ore): the refinery's ore stores. They take only ores (`storageAccepts`).
  'module.storage_ore': {
    name: 'Ore bin',
    category: 'storage',
    description: "A tip bin that takes only ore. Feeds the refinery.",
    asset: 'module.storage_ore', footprint: [2, 2], solid: true, access: [0, 2], power: 0,
    flammability: 0.1, maxHp: 120, buildWork: 90, cost: [{ item: 'item.metal', count: 10 }], storage: { capacity: 24 }, storageAccepts: Object.keys(ORE_ART), storageArt: ORE_ART,
  },
  'module.storage_ore_large': {
    name: 'Large ore bin',
    category: 'storage',
    description: "A large ore bin. Takes only ore.",
    asset: 'module.storage_ore_large', footprint: [3, 2], solid: true, access: [1, 2], power: 0,
    flammability: 0.1, maxHp: 180, buildWork: 130, cost: [{ item: 'item.metal', count: 16 }], storage: { capacity: 40 }, storageAccepts: Object.keys(ORE_ART), storageArt: ORE_ART,
  },
  // Scrap cages (art: storage_scrap, the barred cage): where salvaged scrap is stored, beside the scrapper. They take only scrap.
  'module.storage_scrap': {
    name: 'Scrap bin',
    category: 'storage',
    description: "A barred cage that takes only scrap. Feeds the scrapper.",
    asset: 'module.storage_scrap', footprint: [2, 2], solid: true, access: [0, 2], power: 0,
    flammability: 0.1, maxHp: 120, buildWork: 90, cost: [{ item: 'item.metal', count: 10 }], storage: { capacity: 24 }, storageAccepts: SCRAP_IDS, storageArt: SCRAP_ART,
  },
  'module.storage_scrap_large': {
    name: 'Large scrap bin',
    category: 'storage',
    description: "A large barred cage. Takes only scrap.",
    asset: 'module.storage_scrap_large', footprint: [2, 3], solid: true, access: [0, 3], power: 0,
    flammability: 0.1, maxHp: 180, buildWork: 130, cost: [{ item: 'item.metal', count: 16 }], storage: { capacity: 40 }, storageAccepts: SCRAP_IDS, storageArt: SCRAP_ART,
  },
  // A freight container, opened from the doors on one long side. Cargo holds pack them around their walkway.
  'module.cargo_container': {
    name: 'Freight container',
    category: 'storage',
    description: "A freight container opened from one long side. Cargo holds pack them around a walkway.",
    asset: 'module.cargo_container', footprint: [3, 2], solid: true, access: [1, 2], power: 0,
    flammability: 0.2, maxHp: 160, buildWork: 120, cost: [{ item: 'item.metal', count: 16 }], storage: { capacity: 40 },
  },
  // A sickbay cot (walkable, like a bed). No healing mechanic yet.
  'module.med_bed': {
    name: 'Medical bed',
    category: 'life',
    description: "A sickbay cot. Walkable, like a bed. No healing yet.",
    asset: 'module.med_bed', footprint: [1, 2], solid: false, power: 0, flammability: 0.4,
    maxHp: 60, buildWork: 100, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // A power cell bank. No storage-of-power mechanic yet: dressing for engineering.
  'module.battery': {
    name: 'Battery bank',
    category: 'power',
    description: "A bank of power cells. Dressing for engineering until power storage lands.",
    asset: 'module.battery', footprint: [1, 1], solid: true, power: 0, flammability: 0.2,
    maxHp: 80, buildWork: 80, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 6 }],
  },
  // A grow bed. No food growth yet.
  'module.hydroponics': {
    name: 'Hydroponics bed',
    category: 'life',
    description: "A grow bed for fresh food. No growth mechanic yet.",
    asset: 'module.hydroponics', footprint: [2, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.4, maxHp: 60, buildWork: 120, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.polymer', count: 4 }],
  },
  // Ore refinery 3x4: crew refine raw ore at the access tile (east of the last row, beside the console, at rotation 0). Player-buildable
  // and laid out on mining stations' processing floors.
  'module.refinery': {
    name: 'Ore refinery',
    category: 'production',
    description: "Refines raw ore into usable metals. Crew work it from the access tile.",
    asset: 'module.refinery', footprint: [3, 4], solid: true, access: [3, 3], power: -8, powerPriority: 3,
    flammability: 0.1, maxHp: 220, buildWork: 300, workstation: true, crafting: true,
    cost: [{ item: 'item.metal', count: 30 }, { item: 'item.electronics', count: 8 }, { item: 'item.parts', count: 4 }],
  },
} satisfies Record<string, ModuleDef>;
