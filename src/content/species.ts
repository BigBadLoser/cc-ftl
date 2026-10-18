import type { SpeciesDef } from '../sim';

const robot = {
  name: 'Robot',
  moveSpeed: 2.2,
  workSpeed: 1.1,
  restDecay: 0, // never sleeps: it recharges in a robot bay instead
  carryCapacity: 30,
  maxHp: 120,
  designation: 'RX',
  airless: true,
  mechanical: { items: ['item.parts', 'item.metal'], hpPerItem: 25 },
  ionStunSec: 8,
  fearless: true,
  wreck: [{ item: 'item.parts', count: 3 }, { item: 'item.scrap', count: 6 }],
  coreLinked: true,
  // About 14 minutes idle, 7 working or fighting.
  charge: { drainPerSec: 0.12, busyMult: 2, lowBelow: 20 },
} satisfies SpeciesDef;

export const species = {
  'species.human': {
    name: 'Human',
    moveSpeed: 2.5,
    workSpeed: 1,
    // Rest drains in a few minutes so sleeping is easy to observe while testing.
    restDecay: 0.6,
    carryCapacity: 20,
  },
  // Robot crew (the rogue AI faction; player-built in robot bays). Variants are roles (role.robot_*).
  'species.robot': robot,
  // Security chassis: armoured and heavier, slower; wrecks yield more parts.
  'species.robot_heavy': {
    ...robot,
    name: 'Heavy robot',
    moveSpeed: 1.8,
    workSpeed: 0.9,
    maxHp: 200,
    armor: 0.3,
    designation: 'SX',
    wreck: [{ item: 'item.parts', count: 5 }, { item: 'item.scrap', count: 10 }],
  },
} satisfies Record<string, SpeciesDef>;
