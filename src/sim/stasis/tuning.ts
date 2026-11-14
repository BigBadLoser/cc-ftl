import { HOUR_TICKS } from '../clock';
import { TICK_HZ } from '../time';

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
/**
 * Seconds a crew member at work speed 1 takes to stow a slab at the wheel's hatch (game speed 1): the loading animation's length
 * (render/stasisLoad.ts plays its 63 frames over the job's progress, so they pause and speed up with the game).
 */
export const STOW_SECONDS = 7.9;
/** Seconds one Geneva star step of the wheel takes (6 frames at 8 fps, render/stasisLoad.ts): the wheel turns k steps before a slab is loaded. */
export const TURN_STEP_SECONDS = 0.75;
/** Work (ticks at work speed 1) of one turn step. */
export const TURN_STEP_WORK = Math.round(TURN_STEP_SECONDS * TICK_HZ);
/** Work (ticks at work speed 1) to load a slab once its slot is at the hatch; the one owner of the animation's length. */
export const STOW_WORK = Math.round(STOW_SECONDS * TICK_HZ);
