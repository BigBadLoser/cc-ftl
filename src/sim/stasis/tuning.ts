import { HOUR_TICKS } from '../clock';

/** The item an empty stasis slab is (made at a fabricator, bought, or standing empty in a wheel slot). */
export const SLAB_ITEM = 'item.stasis_slab';
/** Slots in a stasis wheel. */
export const WHEEL_SLOTS = 10;
/** A full slab's reserve: one game hour (ticks) out of a powered wheel before its prisoner thaws. */
export const RESERVE_TICKS = HOUR_TICKS;
/** Reserve ticks a powered wheel puts back per tick (an empty reserve is full again in a quarter of a game hour). */
export const REFILL_PER_TICK = 4;
/** Work (ticks at work speed 1) to seal a prisoner into a slab. */
export const SEAL_WORK = 60;
/** How far (steps over walkable tiles) a dropped slab or a thawed prisoner is placed from where it should be, at most. */
export const PLACE_STEPS = 6;
