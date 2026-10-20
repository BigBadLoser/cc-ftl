import type { ModuleDef } from '../sim';

/**
 * Room furniture the ship generator's room recipes lay out (src/sim/shipgen/rooms). Mess tables and chairs have art
 * (the food pack); the rest are planned modules with no art yet, drawn by the fallback until their sheets exist.
 * None of them adds a mechanic: storage holds items like a crate, the others are dressing (no sit-to-eat yet).
 */
export const furniture = {
  // 2x1 table; crew sit on chairs beside its long sides. Not in the sim yet: eating at a table.
  'module.mess_table': {
    name: 'Mess table', asset: 'module.mess_table', footprint: [2, 1], solid: true, power: 0, flammability: 0.3,
    maxHp: 50, buildWork: 60, cost: [{ item: 'item.metal', count: 4 }, { item: 'item.polymer', count: 2 }],
  },
  // A seat (walkable). A seated crew member faces r0 -y, r1 +x, r2 +y, r3 -x.
  'module.chair': {
    name: 'Chair', asset: 'module.chair', footprint: [1, 1], solid: false, power: 0, flammability: 0.4,
    maxHp: 30, buildWork: 30, cost: [{ item: 'item.metal', count: 2 }, { item: 'item.polymer', count: 1 }],
  },
  'module.storage_locker': {
    name: 'Locker', asset: 'module.storage_locker', footprint: [1, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.2, maxHp: 50, buildWork: 50, cost: [{ item: 'item.metal', count: 4 }], storage: { capacity: 4 },
  },
  // Shelving along an aisle, worked from its front (access) side.
  'module.storage_rack': {
    name: 'Storage rack', asset: 'module.storage_rack', footprint: [2, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.2, maxHp: 80, buildWork: 90, cost: [{ item: 'item.metal', count: 10 }], storage: { capacity: 16 },
  },
  'module.storage_pallet': {
    name: 'Cargo pallet', asset: 'module.storage_pallet', footprint: [2, 2], solid: true, access: [0, 2], power: 0,
    flammability: 0.3, maxHp: 100, buildWork: 80, cost: [{ item: 'item.metal', count: 8 }], storage: { capacity: 24 },
  },
  // A sickbay cot (walkable, like a bed). No healing mechanic yet.
  'module.med_bed': {
    name: 'Medical bed', asset: 'module.med_bed', footprint: [1, 2], solid: false, power: 0, flammability: 0.4,
    maxHp: 60, buildWork: 100, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 4 }],
  },
  // A power cell bank. No storage-of-power mechanic yet: dressing for engineering.
  'module.battery': {
    name: 'Battery bank', asset: 'module.battery', footprint: [1, 1], solid: true, power: 0, flammability: 0.2,
    maxHp: 80, buildWork: 80, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.electronics', count: 6 }],
  },
  // A grow bed. No food growth yet.
  'module.hydroponics': {
    name: 'Hydroponics bed', asset: 'module.hydroponics', footprint: [2, 1], solid: true, access: [0, 1], power: 0,
    flammability: 0.4, maxHp: 60, buildWork: 120, cost: [{ item: 'item.metal', count: 6 }, { item: 'item.polymer', count: 4 }],
  },
} satisfies Record<string, ModuleDef>;
