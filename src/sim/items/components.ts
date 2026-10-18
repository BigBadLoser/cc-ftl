import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';

/** A loose stack lying on a floor tile. One stack per tile: the grid's `item` field holds its entity id. */
export interface ItemStack {
  item: string;
  count: number;
  gridId: number;
  x: number;
  y: number;
  /** Tick of the last 'storage.full' warning for this stack (debounce). */
  warnedAt?: number;
}
export const ItemStackC = defineComponent<ItemStack>('itemStack');

/** On storage modules. Each entry of `stacks` is one slot (at most the item's stackSize). */
export interface Storage {
  /** Slots. */
  capacity: number;
  /** Accepted item ids, or null for everything. */
  filter: string[] | null;
  stacks: ItemQty[];
}
export const StorageC = defineComponent<Storage>('storage');

/** One stack a crew member holds. Dropped on the floor if the crew member loses its hauling job. */
export interface Carrying {
  item: string;
  count: number;
}
export const CarryingC = defineComponent<Carrying>('carrying');

export interface ProductionOrder {
  recipe: string;
  /** 'count': make `target` batches. 'keep': craft while total stock of the recipe's first output is below `target`. */
  mode: 'count' | 'keep';
  target: number;
  /** Batches finished so far. */
  done: number;
}

/** On crafting modules: orders worked top to bottom. */
export interface Production {
  orders: ProductionOrder[];
}
export const ProductionC = defineComponent<Production>('production');

/** Where a haul takes from or delivers to. `id` is the stack, module or job entity. */
export interface HaulRef {
  kind: 'floor' | 'storage' | 'job' | 'vehicle';
  id: number;
}

/**
 * A haul job, in two phases. 'pickup': the crew member walks next to the source and takes up to
 * `count` units (capped by carry capacity, which also sets `count` to what was taken). 'deliver':
 * the job's x,y is retargeted to the destination and the crew member deposits what they carry.
 * While pending in 'pickup' a haul reserves `count` units of its source; while pending at all it
 * reserves the same room at its destination.
 */
export interface HaulData {
  item: string;
  count: number;
  phase: 'pickup' | 'deliver';
  src: HaulRef;
  dst: HaulRef;
}
