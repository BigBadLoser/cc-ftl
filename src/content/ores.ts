import type { OreDef } from '../sim';

/**
 * Ore kinds in asteroid rock. `code` is the value of the `ore` tile field: unique, never reused. Each yields a raw item: iron and
 * rare ore are refined at a refinery (iron ore to metal, rare ore to electronics); ice is used as is.
 */
export const ores = {
  'ore.iron': { code: 1, name: 'Iron', item: 'item.iron_ore', weight: 5, amount: [20, 60], color: 0xb4643c },
  'ore.ice': { code: 2, name: 'Ice', item: 'item.ice', weight: 4, amount: [30, 80], color: 0x9ad8f0 },
  'ore.rare': { code: 3, name: 'Rare metals', item: 'item.rare_ore', weight: 1, amount: [5, 20], color: 0xd8b8ff },
  // Reactor fuel. NEEDS ART: the deposit borrows the rare metals' sprite, tinted by `color`.
  'ore.crystal': { code: 4, name: 'Energy crystal', item: 'item.energy_crystal', weight: 3, amount: [15, 40], color: 0x5cf0b8 },
} satisfies Record<string, OreDef>;
