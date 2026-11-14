import { describe, expect, it } from 'vitest';
import { CART_TICKS, HATCH_FRAMES, LOAD_FPS, LOAD_TICKS, STAR_FRAMES, loadPlan, loadTick, patchId, planHasCart, turnPlan } from './stasisLoad';
import { STOW_SECONDS, STOW_WORK, TURN_STEP_SECONDS, TURN_STEP_WORK } from '../sim/stasis/tuning';
import { TICK_HZ } from '../sim/time';

describe('stasis loading animation', () => {
  it('has the 63 designed ticks, the cart in ha0..hl9', () => {
    expect(LOAD_TICKS).toBe(63);
    expect(HATCH_FRAMES).toHaveLength(55);
    expect(new Set(HATCH_FRAMES).size).toBe(55);
    expect(HATCH_FRAMES[CART_TICKS[0]]).toBe('ha0');
    expect(HATCH_FRAMES[CART_TICKS[1]]).toBe('hl9');
    expect(HATCH_FRAMES.filter((_, t) => planHasCart(t))).toHaveLength(27);
  });

  it('maps progress 0..1 onto the ticks, in order, each once', () => {
    expect(loadTick(0)).toBe(0);
    expect(loadTick(1)).toBe(LOAD_TICKS - 1);
    expect(loadTick(-1)).toBe(0);
    expect(loadTick(2)).toBe(LOAD_TICKS - 1);
    const seen = Array.from({ length: 6300 }, (_, i) => loadTick(i / 6300));
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
    expect(new Set(seen).size).toBe(LOAD_TICKS);
  });

  it('plays the hatch patches, then the star steps with the slab home, then holds', () => {
    expect(loadPlan(0)).toEqual({ tick: 0, key: 'L0', patch: 'hd0', home: false });
    expect(loadPlan(54)).toEqual({ tick: 54, key: 'L54', patch: 'he1', home: false });
    expect(loadPlan(55)).toEqual({ tick: 55, key: 'L55', patch: 's0', home: true });
    expect(loadPlan(60)).toEqual({ tick: 60, key: 'L60', patch: 's5', home: true });
    expect(loadPlan(62)).toEqual({ tick: 62, key: 'L62', patch: null, home: true });
    expect(patchId('hc09', 2)).toBe('stasisload.hc09.r2');
  });

  it('one stow lasts STOW_SECONDS at game speed 1, owned in the stasis tuning', () => {
    expect(STOW_WORK).toBe(Math.round(STOW_SECONDS * TICK_HZ));
    expect(STOW_SECONDS).toBeGreaterThan(7.5);
    expect(STOW_SECONDS).toBeLessThan(8.5);
  });

  it('plays a turn step as the star patches s0-s5 over TURN_STEP_SECONDS', () => {
    expect(STAR_FRAMES / LOAD_FPS).toBe(TURN_STEP_SECONDS);
    expect(TURN_STEP_WORK).toBe(Math.round(TURN_STEP_SECONDS * TICK_HZ));
    expect(turnPlan(2, 0).patch).toBe('s0');
    expect(turnPlan(2, 0.999).patch).toBe(`s${STAR_FRAMES - 1}`);
    expect(new Set(Array.from({ length: 30 }, (_, i) => turnPlan(0, i / 30).patch)).size).toBe(STAR_FRAMES);
    expect(turnPlan(1, 0.5).key).not.toBe(turnPlan(2, 0.5).key);
  });
});
