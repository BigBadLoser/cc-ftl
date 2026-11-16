import type { ItemQty } from '../sim';

/** Build cost per struct kind. Deconstructing refunds half, rounded down. */
export const structCosts = {
  floor: [{ item: 'item.metal', count: 1 }],
  wall: [{ item: 'item.metal', count: 2 }],
  /** One window tile (on top of the wall under it); deconstructing refunds half back and leaves the wall. */
  window: [{ item: 'item.metal', count: 2 }, { item: 'item.polymer', count: 1 }],
  door: [{ item: 'item.metal', count: 2 }, { item: 'item.electronics', count: 1 }],
} satisfies Record<string, ItemQty[]>;
