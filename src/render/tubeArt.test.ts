import { describe, expect, it } from 'vitest';
import { tubePieces, tubeTiles } from './tubeArt';
import type { TubeRun } from '../sim/tube';

const X: TubeRun = { axis: 'x', x: 5, y: 2, len: 3, far: { x: 4, y: 2 }, near: { x: 8, y: 2 } };
const Y1: TubeRun = { axis: 'y', x: 10, y: 5, len: 1, far: { x: 10, y: 4 }, near: { x: 10, y: 6 } };
const look = { roofed: false, farOpen: false, nearOpen: true };

describe('tube art', () => {
  it('an x tube: the far port, the glass west to east, the near port and junction', () => {
    expect(tubePieces(X, look).map((p) => `${p.id}@${p.x},${p.y}`)).toEqual([
      'tube.port.e@5,2',
      'tube.x.west@5,2', 'tube.x.west.front@5,2', 'tube.x.mid@6,2', 'tube.x.mid.front@6,2', 'tube.x.east@7,2', 'tube.x.east.front@7,2',
      'tube.port.w@7,2', 'tube.junction.w.open@8,3', 'tube.junction.w.open.front@8,3',
    ]);
  });

  it('a one-tile y tube, roofed: the port cut against the hull, no junction', () => {
    expect(tubePieces(Y1, { ...look, roofed: true, farOpen: true }).map((p) => `${p.id}@${p.x},${p.y}`)).toEqual([
      'tube.port.s.roofed.open@10,5', 'tube.y.one@10,5', 'tube.y.one.front@10,5', 'tube.port.n@10,5',
    ]);
  });

  it('back to front on one tile: port and glass under the crew (depth 0), the glass front and near port over them', () => {
    const p = tubePieces(Y1, look);
    expect(p.filter((q) => q.x === 10 && q.y === 5).map((q) => q.dz)).toEqual([-0.02, -0.01, 0.5, 0.505]);
  });

  it('a front layer covers crew up to the next tile, but stops at the end of the tube', () => {
    const fronts = tubePieces(X, look).filter((q) => q.id.startsWith('tube.x.') && q.id.endsWith('.front')).map((q) => q.dz);
    expect(fronts).toEqual([0.9, 0.9, 0.5]);
  });

  it('the junction either side of crew in the near door: its back over the near port, its front to the middle of the door', () => {
    const d = (q: { x: number; y: number; dz: number }) => q.x + q.y + q.dz;
    const p = tubePieces(X, look), port = p.find((q) => q.id === 'tube.port.w')!;
    const [back, front] = p.filter((q) => q.id.startsWith('tube.junction')).map(d) as [number, number];
    const door = X.near.x + X.near.y;
    expect(back).toBeGreaterThan(d(port));
    expect(back).toBeLessThan(door - 0.45);
    expect(front).toBeCloseTo(door + 0.02);
  });

  it('the wall tiles it stands in for', () => {
    expect(tubeTiles(X)).toEqual({ port: { x: 4, y: 2 }, row: [{ x: 4, y: 1 }, { x: 4, y: 3 }], junction: [{ x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 3 }] });
    expect(tubeTiles(Y1).row).toEqual([{ x: 9, y: 4 }, { x: 11, y: 4 }]);
  });
});
