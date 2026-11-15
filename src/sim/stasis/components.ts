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
 *  - 'floor': lying on the deck, its head on (x, y) and its foot on the next tile along +x (`rot` 0) or +y (`rot` 1);
 *  - 'vehicle': in the slab rack of the shuttle `carrier` (`SlabRackC`), on its way to a ship with a wheel (stasis/shuttle.ts).
 * (x, y) is always the slab's last tile: the floor tile, the carrier's tile, the wheel's access tile, or where it was loaded into the shuttle. Use `slabPlace` (stasis/query.ts) to read it.
 */
export interface Stasis {
  /** Ticks of reserve left: drains while the slab is out of a powered wheel (not while carried or in a shuttle), refills in one; the prisoner thaws at 0. */
  reserve: number;
  at: 'wheel' | 'carried' | 'floor' | 'vehicle';
  /** The crew member carrying the slab ('carried'), or the shuttle holding it ('vehicle'), else 0. */
  carrier: number;
  x: number;
  y: number;
  /** 'floor': which way the slab lies from (x, y): 0 along +x, 1 along +y. */
  rot: 0 | 1;
}
export const StasisC = defineComponent<Stasis>('stasis');

/**
 * On a crew member pushing a slab on a hover cart who stands still or is about to: where the cart is parked, on (x, y) and the next tile along +x
 * (`rot` 0) or +y (`rot` 1), its push bar end beside them. Set by the stasis system when they stop, or already over their last steps (then `at`
 * is the tile they are walking to), kept until they walk elsewhere or the cart is gone. Read it through `cartRest` (stasis/query.ts).
 */
export interface CartRest {
  x: number;
  y: number;
  rot: 0 | 1;
  /** Set when parked ahead of the stop: the tile the carrier is walking to (the cart was moved there before they arrived). */
  at?: { x: number; y: number };
}
export const CartRestC = defineComponent<CartRest>('cartRest');

/**
 * On a shuttle that carries slabs for a prize (#116, stasis/shuttle.ts): the empty slabs in its rack. The full slabs in it are the prisoners whose
 * `StasisC` is at 'vehicle' with this shuttle as `carrier`; empty and full together fit in RACK_SLOTS.
 */
export interface SlabRack {
  empty: number;
}
export const SlabRackC = defineComponent<SlabRack>('slabRack');

/** Where a seal job takes its empty slab from: a wheel slot, a storage module, a loose stack on the floor, or a shuttle's rack (entity ids). */
export interface SlabSource {
  kind: 'wheel' | 'storage' | 'floor' | 'rack';
  id: number;
}

/**
 * A 'stasis' job's state (`Job.stasis`; `Job.target` is the prisoner). Phases, each with the job's tile at its stop:
 *  - 'fetch': take an empty slab from `from`;  - 'seal': seal the prisoner in where they are;
 *  - 'pickup': lift a full slab off the floor;  - 'stow': stand the slab on the cart in a slot of `wheel`;
 *  - 'ship': hand the slab on the cart into the rack of the shuttle `rack` serving the ship (a prize with no wheel that takes it);
 *  - 'unstow': take a full slab out of its wheel onto the cart (a prisoner handed over at a station: `deliver`).
 * `deliver` is set on a job posted for a prisoner's handover (capture/delivery.ts): the shuttle at the airlock the slab goes into, in place of a wheel.
 */
export interface StasisJob {
  phase: 'fetch' | 'seal' | 'pickup' | 'stow' | 'ship' | 'unstow';
  /** A handover: the shuttle whose rack the slab is carted to (capture/delivery.ts). */
  deliver?: number;
  from?: SlabSource;
  wheel?: number;
  /** Ship: the shuttle whose rack the slab goes into. */
  rack?: number;
  /** Stow: steps the wheel turns before the slab is loaded (ring.ts); the job's work is the turn then the load. */
  turns?: number;
}
