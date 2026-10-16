import { describe, expect, it } from 'vitest';
import { meshModel } from './mesher';
import { VoxelModel } from './model';
import { P } from './palette';

describe('meshModel', () => {
  it('solid 2x2x2 cube is 6 quads', () => {
    const m = new VoxelModel(2, 2, 2).box(0, 0, 0, 2, 2, 2, P.steel);
    const r = meshModel(m, 1);
    expect(r.quads).toBe(6);
    expect(r.solid?.getAttribute('position').count).toBe(24);
    expect(r.emissive).toBeNull();
  });

  it('different colours do not merge', () => {
    const m = new VoxelModel(2, 1, 1).set(0, 0, 0, P.steel).set(1, 0, 0, P.rust);
    // +y,-y,+z,-z faces: 2 each (split by colour); +x and -x: 1 each.
    expect(meshModel(m, 1).quads).toBe(10);
  });

  it('hides faces between adjacent voxels', () => {
    const m = new VoxelModel(2, 1, 1).set(0, 0, 0, P.steel).set(1, 0, 0, P.steel);
    expect(meshModel(m, 1).quads).toBe(6);
  });

  it('routes emissive voxels to their own geometry and scales output', () => {
    const m = new VoxelModel(1, 1, 1).set(0, 0, 0, P.cyan);
    const r = meshModel(m, 0.5);
    expect(r.solid).toBeNull();
    r.emissive?.computeBoundingBox();
    expect(r.emissive?.boundingBox?.max.x).toBeCloseTo(0.5);
  });
});
