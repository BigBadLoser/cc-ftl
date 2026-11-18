import { describe, expect, it } from 'vitest';
import { gridFromTemplate } from './ship';
import { Struct, writeStruct } from './structure';
import { isTube, templateTubes, tubeRows, tubeRuns } from './tube';

/** Two modules joined by a three-tile tube along x, and a one-tile tube down from the east one along y. */
const T = {
  name: 'tubes',
  rows: ['#####...#####', '#___#####___#', '#___D___D___#', '#___#####___#', '#####...##D##', '.........#_#.', '.........#D#.', '.........#_#.'],
  tubes: ['', '', '.....ooo', '', '', '..........o'],
};

describe('tubes', () => {
  it('marks only the template\'s tube floor tiles', () => {
    const g = gridFromTemplate(T);
    expect(isTube(g, 5, 2) && isTube(g, 7, 2) && isTube(g, 10, 5)).toBe(true);
    expect(isTube(g, 4, 2)).toBe(false); // the door
    expect(isTube(g, 5, 1)).toBe(false); // a wall beside the tube
    expect(isTube(g, 2, 2)).toBe(false); // a room's floor
  });

  it('finds each run, its axis and the doors at its ends', () => {
    const g = gridFromTemplate(T);
    expect(tubeRuns(g)).toEqual([
      { axis: 'x', x: 5, y: 2, len: 3, far: { x: 4, y: 2 }, near: { x: 8, y: 2 } },
      { axis: 'y', x: 10, y: 5, len: 1, far: { x: 10, y: 4 }, near: { x: 10, y: 6 } },
    ]);
  });

  it('a tube tile that stops being floor stops being a tube\'s', () => {
    const g = gridFromTemplate(T);
    writeStruct(g, 6, 2, Struct.Space);
    writeStruct(g, 6, 2, Struct.Floor);
    expect(isTube(g, 6, 2)).toBe(false);
    expect(tubeRuns(g).filter((r) => r.axis === 'x').map((r) => r.len)).toEqual([1, 1]);
  });

  it('a tube keeps its run and axis once the doors at its ends are breached', () => {
    const g = gridFromTemplate(T);
    for (const [x, y] of [[4, 2], [8, 2], [10, 4], [10, 6]] as const) writeStruct(g, x, y, Struct.Floor);
    expect(tubeRuns(g).map((r) => [r.axis, r.len])).toEqual([['x', 3], ['y', 1]]);
    // (a one-tile tube along x: with its doors gone its axis comes from its walls)
    const one = gridFromTemplate({ name: 'one', rows: ['#######', '#_D_D_#', '#######'], tubes: ['', '...o'] });
    writeStruct(one, 2, 1, Struct.Floor);
    writeStruct(one, 4, 1, Struct.Floor);
    expect(tubeRuns(one)).toEqual([{ axis: 'x', x: 3, y: 1, len: 1, far: { x: 2, y: 1 }, near: { x: 4, y: 1 } }]);
  });

  it('template rows round-trip', () => {
    const rows = tubeRows(13, 8, new Set([2 * 13 + 5, 2 * 13 + 6, 5 * 13 + 10]));
    expect(templateTubes({ tubes: rows })).toEqual([{ x: 5, y: 2 }, { x: 6, y: 2 }, { x: 10, y: 5 }]);
  });
});
