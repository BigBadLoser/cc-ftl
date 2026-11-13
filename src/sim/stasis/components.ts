import { defineComponent } from '../ecs';

/** A wheel slot with nothing in it. */
export const SLOT_NONE = 0;
/** A wheel slot holding an empty slab (stock for sealing; the same thing as one `item.stasis_slab`). */
export const SLOT_EMPTY = -1;

/**
 * On a stasis wheel module (`ModuleDef.stasisWheel`): its slots in order, each SLOT_NONE, SLOT_EMPTY or the id of the frozen prisoner whose full
 * slab stands in it (that crew entity carries `StasisC`). The wheel is the one record of which slot a full slab is in. Slot 0 is the slot at the
 * wheel's access (hatch) corner; the rest follow counter-clockwise seen from above, in the module's own unrotated frame (render draws one layer
 * per slot in this order). A wheel is built with every slot holding an empty slab.
 */
export interface StasisWheel {
  slots: number[];
}
export const StasisWheelC = defineComponent<StasisWheel>('stasisWheel');

/**
 * On a frozen prisoner (a crew entity with PrisonerC): they are sealed in a full stasis slab and out of the world (no Position, Path or job).
 * The slab is this component; the prisoner entity keeps their identity (name, faction, look) for later hand-over. Where the slab is:
 *  - 'wheel': in a slot of a stasis wheel (the wheel's `StasisWheelC.slots` says which);
 *  - 'carried': on the hover cart of the crew member `carrier`;
 *  - 'floor': lying on the deck, its head on (x, y) and its foot on the next tile along +x (`rot` 0) or +y (`rot` 1).
 * (x, y) is always the slab's last tile: the floor tile, the carrier's tile, or the wheel's access tile. Use `slabPlace` (stasis/query.ts) to read it.
 */
export interface Stasis {
  /** Ticks of reserve left: drains while the slab is out of a powered wheel (not while carried), refills in one; the prisoner thaws at 0. */
  reserve: number;
  at: 'wheel' | 'carried' | 'floor';
  /** The crew member carrying the slab ('carried'), else 0. */
  carrier: number;
  x: number;
  y: number;
  /** 'floor': which way the slab lies from (x, y): 0 along +x, 1 along +y. */
  rot: 0 | 1;
}
export const StasisC = defineComponent<Stasis>('stasis');

/**
 * On a crew member pushing a slab on a hover cart while they stand still: where the cart is parked, on (x, y) and the next tile along +x (`rot` 0)
 * or +y (`rot` 1), its push bar end beside them. Set by the stasis system when they stop, kept until they walk again or the cart is gone. Read it
 * through `cartRest` (stasis/query.ts).
 */
export interface CartRest {
  x: number;
  y: number;
  rot: 0 | 1;
}
export const CartRestC = defineComponent<CartRest>('cartRest');

/** Where a seal job takes its empty slab from: a wheel slot, a storage module, or a loose stack on the floor (entity ids). */
export interface SlabSource {
  kind: 'wheel' | 'storage' | 'floor';
  id: number;
}

/**
 * A 'stasis' job's state (`Job.stasis`; `Job.target` is the prisoner). Phases, each with the job's tile at its stop:
 *  - 'fetch': take an empty slab from `from`;  - 'seal': seal the prisoner in where they are;
 *  - 'pickup': lift a full slab off the floor;  - 'stow': stand the slab on the cart in a slot of `wheel`.
 */
export interface StasisJob {
  phase: 'fetch' | 'seal' | 'pickup' | 'stow';
  from?: SlabSource;
  wheel?: number;
}
