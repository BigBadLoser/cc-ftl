import { SLOT_EMPTY, SLOT_NONE } from './components';
import { STOW_WORK, TURN_STEP_WORK, UNSTOW_WORK } from './tuning';

/**
 * The stasis wheel's slots are a ring (#116): slot 0 is always the one at the hatch, and the wheel turns, a Geneva star step at a time, to bring
 * another slot there before a slab is loaded, and one step more once it is in (stowSlab). Turning is a rotation of `StasisWheelC.slots`; this file owns that and the way a stow's work is
 * split into the turn and the load (the loading animation plays over it, render/stasisLoad.ts). An unstow (a handover) turns the prisoner's slot to
 * the hatch and plays the load's hatch frames backwards. Pure functions over the slot array.
 */

/**
 * Steps the wheel turns before a slab can be loaded: to the first slot holding nothing, else (every slot holds a slab) the first one holding an
 * empty slab, whose slab is then set out at the hatch (stowSlab). -1 when every slot holds a prisoner.
 */
export function turnsToLoad(slots: readonly number[]): number {
  const free = slots.indexOf(SLOT_NONE);
  return free >= 0 ? free : slots.indexOf(SLOT_EMPTY);
}

/** The ring after `k` steps (a copy): the slot `k` places on comes to the hatch, slot 0. Negative or past a full turn wrap. */
export function ringAfter<T>(slots: readonly T[], k: number): T[] {
  const n = slots.length;
  return slots.map((_, i) => slots[(((i + k) % n) + n) % n] as T);
}

/** Turn the ring `k` steps in place. */
export function turnRing(slots: number[], k: number): void {
  slots.splice(0, slots.length, ...ringAfter(slots, k));
}

/** The work of a stow (or, `out`, an unstow) that first turns the wheel `turns` steps. */
export const stowWork = (turns: number, out = false): number => Math.max(0, turns) * TURN_STEP_WORK + (out ? UNSTOW_WORK : STOW_WORK);

/** Steps the wheel turns to bring the prisoner's slot to the hatch before their slab is taken out; -1 when they are not in it. */
export const turnsToUnload = (slots: readonly number[], prisoner: number): number => slots.indexOf(prisoner);

/** Where a stow with `turns` steps stands after `elapsed` work: turning (step done so far, how far into the next, 0..1) or loading (0..1). */
export type StowStage = { turning: true; step: number; frac: number } | { turning: false; load: number };

export function stowStageAt(elapsed: number, turns: number, out = false): StowStage {
  const turnWork = Math.max(0, turns) * TURN_STEP_WORK;
  if (elapsed < turnWork) return { turning: true, step: Math.floor(elapsed / TURN_STEP_WORK), frac: (elapsed % TURN_STEP_WORK) / TURN_STEP_WORK };
  return { turning: false, load: Math.min(1, (elapsed - turnWork) / (out ? UNSTOW_WORK : STOW_WORK)) };
}
