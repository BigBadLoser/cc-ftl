import { describe, expect, it } from 'vitest';
import { SLOT_EMPTY as E, SLOT_NONE as N } from './components';
import { ringAfter, stowStageAt, stowWork, turnRing, turnsToLoad } from './ring';
import { STOW_WORK, TURN_STEP_WORK } from './tuning';

describe('stasis wheel ring', () => {
  it('turns to the first slot holding nothing, else the first holding an empty slab, else cannot load', () => {
    expect(turnsToLoad([E, E, N, E, N])).toBe(2);
    expect(turnsToLoad([N, E, E])).toBe(0);
    expect(turnsToLoad([7, E, 8, E])).toBe(1);        // every slot holds a slab: the first empty one (its slab is set out)
    expect(turnsToLoad([E, E, E])).toBe(0);
    expect(turnsToLoad([7, 8, 9])).toBe(-1);
  });

  it('rotates so the slot k places on comes to the hatch (slot 0), wrapping', () => {
    expect(ringAfter([0, 1, 2, 3, 4], 2)).toEqual([2, 3, 4, 0, 1]);
    expect(ringAfter([0, 1, 2, 3, 4], 5)).toEqual([0, 1, 2, 3, 4]);
    expect(ringAfter([0, 1, 2, 3, 4], -1)).toEqual([4, 0, 1, 2, 3]);
    const slots = [5, E, N, 6];
    turnRing(slots, turnsToLoad(slots));
    expect(slots).toEqual([N, 6, 5, E]);              // the free slot is at the hatch, the order round the ring is kept
  });

  it('splits a stow into k star steps, then the load', () => {
    expect(stowWork(0)).toBe(STOW_WORK);
    expect(stowWork(3)).toBe(STOW_WORK + 3 * TURN_STEP_WORK);
    expect(stowStageAt(0, 0)).toEqual({ turning: false, load: 0 });
    expect(stowStageAt(TURN_STEP_WORK * 1.5, 3)).toEqual({ turning: true, step: 1, frac: 0.5 });
    expect(stowStageAt(TURN_STEP_WORK * 3, 3)).toEqual({ turning: false, load: 0 });
    expect(stowStageAt(TURN_STEP_WORK * 3 + STOW_WORK / 2, 3)).toEqual({ turning: false, load: 0.5 });
    expect(stowStageAt(stowWork(3), 3)).toEqual({ turning: false, load: 1 });
  });
});
