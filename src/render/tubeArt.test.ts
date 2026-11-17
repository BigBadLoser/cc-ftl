import { describe, expect, it } from 'vitest';
import { tubePieces, tubeTiles } from './tubeArt';
import type { TubeRun } from '../sim/tube';

const X: TubeRun = { axis: 'x', x: 5, y: 2, len: 3, far: { x: 4, y: 2 }, near: { x: 8, y: 2 } };
const Y1: TubeRun = { axis: 'y', x: 10, y: 5, len: 1, far: { x: 10, y: 4 }, near: { x: 10, y: 6 } };
const look = { level: 'cut' as const, roofed: false, farOpen: false, nearOpen: true };

describe('tube art', () => {
  it('an x tube: the far hull row and port, the glass west to east, the near port and junction', () => {
    expect(tubePieces(X, look).map((p) => `${p.id}@${p.x},${p.y}`)).toEqual([
      'tube.hull.r1.cut@4,3', 'tube.hull.r1.cut.tint@4,3', 'tube.port.e@5,2',
      'tube.x.west@5,2', 'tube.x.west.front@5,2', 'tube.x.mid@6,2', 'tube.x.mid.front@6,2', 'tube.x.east@7,2', 'tube.x.east.front@7,2',
      'tube.port.w@7,2', 'tube.junction.w.open@8,3',
    ]);
  });

  it('a one-tile y tube, roofed: the full-height row, no junction', () => {
    expect(tubePieces(Y1, { ...look, roofed: true, farOpen: true }).map((p) => `${p.id}@${p.x},${p.y}`)).toEqual([
      'tube.hull.r2.up@11,4', 'tube.hull.r2.up.tint@11,4', 'tube.port.s.open@10,5', 'tube.y.one@10,5', 'tube.y.one.front@10,5', 'tube.port.n@10,5',
    ]);
  });

  it('back to front on one tile: port and glass under the crew (depth 0), the glass front and near port over them; the row painted', () => {
    const p = tubePieces(Y1, look);
    expect(p.filter((q) => q.x === 10 && q.y === 5).map((q) => q.dz)).toEqual([-0.02, -0.01, 0.5, 0.505]);
    expect(p.filter((q) => q.paint).map((q) => q.paint)).toEqual(['armour', 'deco']);
  });

  it('a front layer covers crew up to the next tile, but stops at the end of the tube', () => {
    const fronts = tubePieces(X, look).filter((q) => q.id.endsWith('.front')).map((q) => q.dz);
    expect(fronts).toEqual([0.9, 0.9, 0.5]);
  });

  it('the wall tiles it stands in for', () => {
    expect(tubeTiles(X)).toEqual({ port: { x: 4, y: 2 }, row: [{ x: 4, y: 1 }, { x: 4, y: 3 }], junction: [{ x: 8, y: 2 }, { x: 8, y: 1 }, { x: 8, y: 3 }] });
    expect(tubeTiles(Y1).row).toEqual([{ x: 9, y: 4 }, { x: 11, y: 4 }]);
  });
});
