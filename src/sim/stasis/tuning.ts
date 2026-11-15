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
 * (render/stasisLoad.ts plays its 61 frames over the job's progress, so they pause and speed up with the game).
 */
export const STOW_SECONDS = 7.6;
/**
 * Seconds to take a full slab out of the wheel at its hatch (a handover, phase 'unstow'): the loading animation's hatch frames played backwards
 * (55 of its 61 frames, no closing star step: STOW_SECONDS x 55 / 61).
 */
export const UNSTOW_SECONDS = 6.85;
/** Seconds one Geneva star step of the wheel takes (6 frames at 8 fps, render/stasisLoad.ts): the wheel turns k steps before a slab is loaded. */
export const TURN_STEP_SECONDS = 0.75;
/** Work (ticks at work speed 1) of one turn step. */
export const TURN_STEP_WORK = Math.round(TURN_STEP_SECONDS * TICK_HZ);
/** Work (ticks at work speed 1) to load a slab once its slot is at the hatch; the one owner of the animation's length. */
export const STOW_WORK = Math.round(STOW_SECONDS * TICK_HZ);
/**
 * How far through an unload the slab is on the crew member's own cart: the animation's cart has left the patches (its frame ha0, 46 of the 55
 * frames; render/stasisLoad.ts checks it), and the hatch shuts behind them.
 */
export const UNSTOW_LIFT = 46 / 55;
/** Work (ticks at work speed 1) to take a slab out once its slot is at the hatch. */
export const UNSTOW_WORK = Math.round(UNSTOW_SECONDS * TICK_HZ);
/** Slabs (empty and full together) a shuttle's rack holds: what one run carries out to a prize and home again. */
export const RACK_SLOTS = 4;
/** Seconds the shuttle takes to put one empty slab from the ship's stock into its rack at home (the crated loot's pace). */
export const RACK_LOAD_SEC = 2;
