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

/** Shared alien body: a wild creature (no jobs, needs or sleep) that never surrenders. */
const alien = {
  name: 'Alien',
  moveSpeed: 3,
  workSpeed: 0,
  restDecay: 0,
  carryCapacity: 0,
  designation: 'XN',
  airless: true,
  fearless: true,
  creature: { fleeBelow: 0.25 },
} satisfies SpeciesDef;

export const species = {
  'species.human': {
    name: 'Human',
    moveSpeed: 2.5,
    workSpeed: 1,
    // Rest drains in a few minutes so sleeping is easy to observe while testing.
    restDecay: 0.6,
    carryCapacity: 20,
    // Fed to hungry in about 9 minutes (hungry crew eat below 35), starving after about 14.
    hunger: { decayPerSec: 0.12 },
    mood: true,
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
  // --- Derelict aliens (hatched from egg sacs; faction 'alien'; art `crew.alien.body.<kind>`). They do not breathe, so
  // they cross vented, airless decks freely (cold and thin air do nothing to them; heat and fire still do).
  // Hunter: the swarm unit. Fast, melee only, moderate hp.
  'species.alien_hunter': {
    ...alien,
    name: 'Hunter',
    moveSpeed: 3.6,
    maxHp: 60,
    natural: { id: 'claws', kind: 'melee', range: 1, damage: 9, cooldownSec: 0.9, accuracy: 0.75 },
  },
  // Brute: the tank. Slow, high hp, thick chitin, heavy blows that can knock a crew member down for a moment.
  'species.alien_brute': {
    ...alien,
    name: 'Brute',
    moveSpeed: 2.1,
    maxHp: 180,
    armor: 0.2,
    natural: { id: 'crush', kind: 'melee', range: 1, damage: 18, cooldownSec: 1.7, accuracy: 0.7, knockdownChance: 0.35, knockdownSec: 2.5 },
    creature: { fleeBelow: 0.15 },
  },
  // Spitter: ranged. Spits a slow glowing glob and keeps its distance.
  'species.alien_spitter': {
    ...alien,
    name: 'Spitter',
    moveSpeed: 2.8,
    maxHp: 45,
    natural: { id: 'spit', kind: 'ranged', range: 7, damage: 8, cooldownSec: 2.4, accuracy: 0.6 },
    creature: { fleeBelow: 0.3, keepAway: 4 },
  },
} satisfies Record<string, SpeciesDef>;
