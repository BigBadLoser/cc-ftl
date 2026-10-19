import { describe, expect, it } from 'vitest';
import { BAY_FRAME_MS } from './vehicleBayArt';
import { DOCK_CLAMP_DELAY_MS, DOCK_SLIDE_MS, TUBE_STEPS, UNDOCK_DONE_MS, UNDOCK_SLIDE_AT_MS, dockProgress, undockProgress } from './dockSequence';

describe('dock sequence', () => {
  it('slides alongside, then extends the tube frame by frame, then the collar clamps', () => {
    expect(dockProgress(0)).toEqual({ slide: 0, tube: 0 });
    expect(dockProgress(DOCK_SLIDE_MS - 1).tube).toBe(0);
    expect(dockProgress(DOCK_SLIDE_MS).slide).toBe(1);
    expect(dockProgress(DOCK_SLIDE_MS + 1).tube).toBe(1);
    expect(dockProgress(DOCK_SLIDE_MS + BAY_FRAME_MS + 1).tube).toBe(2);
    expect(dockProgress(DOCK_CLAMP_DELAY_MS - 1).tube).toBe(TUBE_STEPS);
    expect(dockProgress(DOCK_CLAMP_DELAY_MS + 5000).tube).toBe(TUBE_STEPS);
  });

  it('undocks in reverse: tube stays mated while the collar unclamps, retracts, then the shuttle slides out and goes', () => {
    expect(undockProgress(0)).toEqual({ slide: 1, tube: TUBE_STEPS });
    expect(undockProgress(3 * BAY_FRAME_MS - 1)?.tube).toBe(TUBE_STEPS);
    expect(undockProgress(3 * BAY_FRAME_MS + 1)?.tube).toBe(2);
    expect(undockProgress(UNDOCK_SLIDE_AT_MS - 1)?.tube).toBe(0);
    expect(undockProgress(UNDOCK_SLIDE_AT_MS - 1)?.slide).toBe(1);
    expect(undockProgress(UNDOCK_DONE_MS - 1)?.slide).toBeLessThan(0.01);
    expect(undockProgress(UNDOCK_DONE_MS)).toBeNull();
  });
});
