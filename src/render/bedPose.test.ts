import { describe, expect, it } from 'vitest';
import type { ModuleDef } from '../sim/registry';
import { bedPose } from './bedPose';

const bed = { footprint: [1, 2] } as unknown as ModuleDef;

describe('bedPose', () => {
  it('centres the sleeper on the footprint, long axis along y at r0/r2 and along x at r1/r3', () => {
    expect(bedPose(bed, 4, 6, 0, false)).toMatchObject({ x: 4, y: 6.5 });
    expect(bedPose(bed, 4, 6, 2, false)).toMatchObject({ x: 4, y: 6.5 });
    expect(bedPose(bed, 4, 6, 1, false)).toMatchObject({ x: 4.5, y: 6 });
    expect(bedPose(bed, 4, 6, 3, false)).toMatchObject({ x: 4.5, y: 6 });
  });
  it('follows the drawn sprite when the bed has one art for all rotations (r2 as r0, r3 as the mirrored r1)', () => {
    expect([0, 1, 2, 3].map((r) => bedPose(bed, 0, 0, r, false).dir)).toEqual([2, 0, 2, 0]);
  });
  it('turns the head clockwise with the bed when each rotation has its own sprite', () => {
    expect([0, 1, 2, 3].map((r) => bedPose(bed, 0, 0, r, true).dir)).toEqual([2, 4, 6, 0]);
  });
});
