import { describe, expect, it } from 'vitest';
import { BAY_FRAME_MS, LAUNCH, LAUNCH_LIFT, RETURN, RETURN_LAND, bayId, createBayAnimator, parkedId, steady, PARKED_DZ, vehicleBayLayers } from './vehicleBayArt';

describe('vehicle bay art ids', () => {
  it('name the bay state and the shuttle parked in it', () => {
    expect(bayId('module.vehicle_bay', 2, '')).toBe('module.vehicle_bay.r2');
    expect(bayId('module.vehicle_bay', 1, 'open.f1')).toBe('module.vehicle_bay.r1.open.f1');
    expect(parkedId(3, 'fold.f0')).toBe('vehicle.shuttle.parked.r3.fold.f0');
  });
});

describe('bay animator', () => {
  it('is steady until the shuttle leaves, then plays the launch sequence and settles on the empty bay', () => {
    const a = createBayAnimator();
    expect(a.stepOf(1, true, 0)).toEqual(steady(true));
    expect(a.stepOf(1, true, 5000)).toEqual({ bay: '', shuttle: '' });
    expect(a.stepOf(1, false, 6000)).toEqual(LAUNCH[0]);
    expect(a.stepOf(1, false, 6000 + (LAUNCH_LIFT.start - 1) * BAY_FRAME_MS + 1)?.shuttle).toBe('fold.f1'); // still parked as the doors open
    expect(a.stepOf(1, false, 6000 + LAUNCH_LIFT.start * BAY_FRAME_MS + 1)?.shuttle).toBeNull(); // the sector sprite takes over
    expect(a.stepOf(1, false, 6000 + LAUNCH.length * BAY_FRAME_MS + 1)).toEqual({ bay: 'empty', shuttle: null });
  });

  it('plays the return sequence ending with the claws closing on the shuttle', () => {
    const a = createBayAnimator();
    a.stepOf(7, false, 0);
    expect(a.stepOf(7, true, 100)).toEqual(RETURN[0]);
    const last = RETURN[RETURN.length - 1];
    expect(a.stepOf(7, true, 100 + (RETURN.length - 1) * BAY_FRAME_MS + 1)).toEqual(last);
    expect(last?.shuttle).toBe('fold.f0');
    expect(a.stepOf(7, true, 100 + RETURN.length * BAY_FRAME_MS + 1)).toEqual({ bay: '', shuttle: '' });
  });

  it('hands the shuttle to the sector layer for the lift and the settle, with the doors open', () => {
    for (let i = LAUNCH_LIFT.start; i < LAUNCH_LIFT.end; i++) expect(LAUNCH[i]).toMatchObject({ bay: 'open.f2', shuttle: null });
    for (let i = RETURN_LAND.start; i < RETURN_LAND.end - 2; i++) expect(RETURN[i]).toMatchObject({ bay: 'open.f2', shuttle: null });
    expect(RETURN[RETURN_LAND.end]?.shuttle).toBe('fold.f1');
  });

  it('tracks bays independently', () => {
    const a = createBayAnimator();
    a.stepOf(1, true, 0);
    a.stepOf(2, false, 0);
    expect(a.stepOf(2, false, 10_000)).toEqual({ bay: 'empty', shuttle: null });
    expect(a.stepOf(1, true, 10_000)).toEqual({ bay: '', shuttle: '' });
  });
});

describe('bay glow depth', () => {
  it('sorts the parked shuttle over the bay layer glow and halo', () => {
    const def = { asset: 'module.vehicle_bay' } as never;
    const layers = vehicleBayLayers({ rot: 0 } as never, def, { bay: '', shuttle: '' } as never);
    expect(layers).toHaveLength(2);
    // Bay glow at key + 0.01 and its halo at + 0.015 (moduleView); the shuttle layer sits above both.
    expect(layers[1]?.dz).toBe(PARKED_DZ);
    expect(PARKED_DZ).toBeGreaterThan(0.015);
  });
});
