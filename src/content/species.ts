import type { SpeciesDef } from '../sim';

export const species = {
  'species.human': {
    name: 'Human',
    moveSpeed: 2.5,
    workSpeed: 1,
    // Rest drains in a few minutes so sleeping is easy to observe while testing.
    restDecay: 0.6,
    carryCapacity: 20,
  },
  // Robot crew (the rogue AI faction, and salvaged or bought units later). Variants are roles (role.robot_*).
  'species.robot': {
    name: 'Robot',
    moveSpeed: 2.2,
    workSpeed: 1.1,
    restDecay: 0, // never sleeps
    carryCapacity: 30,
    maxHp: 120,
    designation: 'RX',
    airless: true,
    mechanical: { items: ['item.parts', 'item.metal'], hpPerItem: 25 },
    ionStunSec: 8,
    fearless: true,
    wreck: [{ item: 'item.parts', count: 3 }, { item: 'item.scrap', count: 6 }],
    coreLinked: true,
  },
} satisfies Record<string, SpeciesDef>;
