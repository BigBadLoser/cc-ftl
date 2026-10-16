import type { ItemDef } from '../sim';

/** Raw and refined resources. Stack sizes are units per floor stack or storage slot. */
export const items = {
  'item.scrap': { name: 'Scrap', tags: ['raw', 'salvage'], stackSize: 100 },
  'item.metal': { name: 'Metal', tags: ['refined', 'building'], stackSize: 100 },
  'item.electronics': { name: 'Electronics', tags: ['refined', 'components'], stackSize: 50 },
  // Flammable: loose polymer on a burning tile burns and feeds the fire.
  'item.polymer': { name: 'Polymer', tags: ['refined', 'building'], stackSize: 50, flammability: 0.6 },
  'item.ice': { name: 'Ice', tags: ['raw', 'water'], stackSize: 50 },
} satisfies Record<string, ItemDef>;
