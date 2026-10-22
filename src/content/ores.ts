import type { OreDef } from '../sim';

/**
 * Ore kinds in asteroid rock. `code` is the value of the `ore` tile field: unique, never reused. Each yields a raw item: iron and
 * rare ore are refined at a refinery (iron ore to metal, rare ore to electronics); ice is used as is.
 */
export const ores = {
  'ore.iron': { code: 1, name: 'Iron', item: 'item.iron_ore', weight: { big: 6, field: 5 }, amount: [20, 60], color: 0xb4643c },
  'ore.ice': { code: 2, name: 'Ice', item: 'item.ice', weight: { big: 3, field: 4 }, amount: [30, 80], color: 0x9ad8f0 },
  'ore.rare': { code: 3, name: 'Rare metals', item: 'item.rare_ore', weight: { big: 1, field: 1 }, amount: [5, 20], color: 0xd8b8ff },
} satisfies Record<string, OreDef>;
