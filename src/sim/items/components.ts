import { defineComponent } from '../ecs';
import type { ItemQty } from '../registry';

/** A loose stack lying on a floor tile. One stack per tile: the grid's `item` field holds its entity id. */
export interface ItemStack {
  item: string;
  count: number;
  x: number;
  y: number;
  /** Tick of the last 'storage.full' warning for this stack (debounce). */
  warnedAt?: number;
  /** Tick a hauler at this stack found its destination out of reach and left it (#476): the planner waits WARN_DEBOUNCE before trying again. */
  stuckAt?: number;
  /** A delivery crate: the StationJob id it belongs to. */
  job?: number;
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
  /** The rest of a construction bundle (see HaulData.extra). */
  extra?: ItemQty[];
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

/**
 * A staging zone, on a ship (grid) entity: floor tiles where loose goods are gathered to be loaded onto a shuttle (items/staging.ts). One
 * stack per tile as anywhere; a full stack overflows to the next tile. `cap`: the units it takes in all. An away site keeps one beside its
 * shuttle's drop-off point (away/haul.ts); it is the site's (away/owned.ts).
 */
export interface Staging {
  tiles: { x: number; y: number }[];
  cap: number;
}
export const StagingC = defineComponent<Staging>('staging');

/** Where a haul takes from or delivers to. `id` is the stack, module or job entity; for 'zone' the ship whose staging zone it is. */
export interface HaulRef {
  kind: 'floor' | 'storage' | 'job' | 'vehicle' | 'zone';
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
  /** Other materials for the same job taken from the same storage on the same trip (a builder carries a whole bundle). */
  extra?: ItemQty[];
  /** Later stops: after the destination is served, what is left goes to these jobs in turn (one trip serves a run of walls). */
  then?: { job: number; count: number }[];
  /**
   * Gathering (items/haul.ts): what the hauler already holds from earlier stacks of this trip while they walk to the next one (`src`).
   * Counted as on its way to `dst`, not out of any source.
   */
  gathered?: ItemQty[];
}
