import type { ItemDef, RecipeDef, ResearchDef } from '../sim';

/**
 * Module upgrades (DESIGN.md "Weapon upgrades and flak"): items that go in a weapon module's slot. The general ones fit any weapon; the numbers are a
 * starting point for tuning. Icons are placeholders (`placeholderIcon`) until the item art lands. Each has a blueprint (researched, then built at a
 * fabricator) and a price; stations sell them and enemy ships carry them (see factions/ and the galaxy trade profiles).
 */
export const upgradeItems = {
  'item.upg_coolant': {
    name: 'Coolant jacket', tags: ['upgrade'], stackSize: 4, price: 120, tier: 2,
    upgrade: { slot: 'weapon', mods: { heatMul: 0.7 } },
    placeholderIcon: { as: 'item.parts', tint: '#4fc3ff' },
  },
  'item.upg_capacitor': {
    name: 'Quick capacitor', tags: ['upgrade'], stackSize: 4, price: 140, tier: 2,
    upgrade: { slot: 'weapon', mods: { chargeMul: 0.85 } },
    placeholderIcon: { as: 'item.electronics', tint: '#ffd23f' },
  },
  'item.upg_housing': {
    name: 'Hardened housing', tags: ['upgrade'], stackSize: 4, price: 130, tier: 2,
    upgrade: { slot: 'weapon', mods: { damageTakenMul: 0.5 } },
    placeholderIcon: { as: 'item.metal', tint: '#9fb4c8' },
  },
} satisfies Record<string, ItemDef>;

/** Fabricator recipes: each needs its blueprint (researched, or sold at a station). */
export const upgradeRecipes = {
  'recipe.upg_coolant': {
    name: 'Build coolant jacket', station: 'module.fabricator', blueprint: 'blueprint.upg_coolant',
    inputs: [{ item: 'item.metal', count: 8 }, { item: 'item.electronics', count: 6 }, { item: 'item.polymer', count: 4 }],
    outputs: [{ item: 'item.upg_coolant', count: 1 }], work: 300,
  },
  'recipe.upg_capacitor': {
    name: 'Build quick capacitor', station: 'module.fabricator', blueprint: 'blueprint.upg_capacitor',
    inputs: [{ item: 'item.metal', count: 4 }, { item: 'item.electronics', count: 12 }],
    outputs: [{ item: 'item.upg_capacitor', count: 1 }], work: 300,
  },
  'recipe.upg_housing': {
    name: 'Build hardened housing', station: 'module.fabricator', blueprint: 'blueprint.upg_housing',
    inputs: [{ item: 'item.metal', count: 16 }, { item: 'item.electronics', count: 4 }],
    outputs: [{ item: 'item.upg_housing', count: 1 }], work: 300,
  },
} satisfies Record<string, RecipeDef>;

const cost = (e: number, parts: number) => [{ item: 'item.electronics', count: e }, { item: 'item.parts', count: parts }];

export const upgradeResearch = {
  'research.upgrade.coolant': {
    name: 'Coolant jacket', description: 'A weapon upgrade: the gun adds 30% less heat to the ship per volley.', category: 'defence',
    cost: cost(10, 3), work: 1500, unlocks: ['blueprint.upg_coolant'], requires: [],
  },
  'research.upgrade.capacitor': {
    name: 'Quick capacitor', description: 'A weapon upgrade: the gun charges 15% faster.', category: 'defence',
    cost: cost(12, 3), work: 1500, unlocks: ['blueprint.upg_capacitor'], requires: [],
  },
  'research.upgrade.housing': {
    name: 'Hardened housing', description: 'A weapon upgrade: the gun takes half damage from hits and ion.', category: 'defence',
    cost: cost(10, 4), work: 1500, unlocks: ['blueprint.upg_housing'], requires: [],
  },
  'research.weapon.flak': {
    name: 'Flak cannon', description: 'A gun that fires hull scrap: a spread of weak pellets that each strip a shield layer, and shoot down drones.', category: 'defence',
    cost: cost(14, 4), work: 1800, unlocks: ['module.flakCannon'], requires: [],
  },
} satisfies Record<string, ResearchDef>;
