import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { World } from '../sim/ecs';
import { PositionC, type Position } from '../sim/crew/components';
import { ModuleC, type Module } from '../sim/modules/components';
import { SLEEP_SHIFT, bedPose, occupiedMedBeds } from './bedPose';
import { showsActive } from './moduleArt';

const bed = { footprint: [1, 2] } as unknown as ModuleDef;

describe('bedPose', () => {
  it('lies on the footprint centre moved toward the foot, long axis along y at r0/r2 and along x at r1/r3', () => {
    expect(bedPose(bed, 4, 6, 0, false)).toMatchObject({ x: 4, y: 6.5 + SLEEP_SHIFT });
    expect(bedPose(bed, 4, 6, 2, false)).toMatchObject({ x: 4, y: 6.5 + SLEEP_SHIFT });
    expect(bedPose(bed, 4, 6, 1, false)).toMatchObject({ x: 4.5 + SLEEP_SHIFT, y: 6 });
    expect(bedPose(bed, 4, 6, 3, false)).toMatchObject({ x: 4.5 + SLEEP_SHIFT, y: 6 });
  });
  it('moves away from the pillow as the bed turns', () => {
    expect([0, 1, 2, 3].map((r) => bedPose(bed, 4, 6, r, true))).toMatchObject([
      { x: 4, y: 6.5 + SLEEP_SHIFT },
      { x: 4.5 - SLEEP_SHIFT, y: 6 },
      { x: 4, y: 6.5 - SLEEP_SHIFT },
      { x: 4.5 + SLEEP_SHIFT, y: 6 },
    ]);
  });
  it('follows the drawn sprite when the bed has one art for all rotations (r2 as r0, r3 as the mirrored r1)', () => {
    expect([0, 1, 2, 3].map((r) => bedPose(bed, 0, 0, r, false).dir)).toEqual([2, 0, 2, 0]);
  });
  it('turns the head clockwise with the bed when each rotation has its own sprite', () => {
    expect([0, 1, 2, 3].map((r) => bedPose(bed, 0, 0, r, true).dir)).toEqual([2, 4, 6, 0]);
  });
});

describe('occupiedMedBeds (#614)', () => {
  it('is a medical bed whose berth holder lies settled on it, not one they are still walking to, nor an ordinary bed', () => {
    const defs = { med: { bed: true, medical: true, footprint: [1, 2] }, bunk: { bed: true, footprint: [1, 2] } } as unknown as Record<string, ModuleDef>;
    const w = new World();
    const at = (x: number, y: number, toX = x): Position => ({ x, y, toX, toY: y, progress: 0, facing: 0 }) as Position;
    const bed = (def: string, x: number, holder: number): number => {
      const id = w.createEntity();
      w.add(id, ModuleC, { def, x, y: 0, rot: 0, hp: 100, powerPriority: 5, enabled: true, powered: true, reservedBy: holder } as Module);
      return id;
    };
    const crew = (p: Position): number => { const id = w.createEntity(); w.add(id, PositionC, p); return id; };
    const lying = crew(at(0, 0)), walking = crew(at(4, 0, 5)), sleeper = crew(at(8, 0));
    const a = bed('med', 0, lying), b = bed('med', 4, walking), c = bed('bunk', 8, sleeper), d = bed('med', 12, 0);
    expect([...occupiedMedBeds(w, defs)]).toEqual([a]);
    expect([b, c, d].some((id) => occupiedMedBeds(w, defs).has(id))).toBe(false);
    const med = defs.med as ModuleDef;
    expect([showsActive(med, true, false, true), showsActive(med, true, false, false), showsActive(med, false, false, true)]).toEqual([true, false, false]); // lain in and powered
  });
});
