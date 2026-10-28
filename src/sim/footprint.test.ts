import { describe, expect, it } from 'vitest';
import {
  applyChange,
  footprintFromGrid,
  footprintFromTiles,
  footprintHas,
  footprintSize,
  openingOf,
  widthOk,
  widthViolations,
  type TileXY,
} from './footprint';
import { DenseGrid } from './grid';
import { SHIP_FIELDS, Struct } from './structure';

/** Parse an ASCII picture: '#' is a tile. */
function shape(rows: string[]): TileXY[] {
  const out: TileXY[] = [];
  rows.forEach((row, y) => [...row].forEach((c, x) => c === '#' && out.push({ x, y })));
  return out;
}
const rect = (w: number, h: number) => shape(Array.from({ length: h }, () => '#'.repeat(w)));
const keys = (t: TileXY[]) => t.map((p) => `${p.x},${p.y}`);

describe('footprint width rule', () => {
  it('empty footprint passes', () => {
    const f = footprintFromTiles([]);
    expect(widthViolations(f)).toEqual([]);
    expect(footprintSize(openingOf(f))).toBe(0);
  });

  it('a 3x3 block passes and equals its own opening', () => {
    const f = footprintFromTiles(rect(3, 3));
    expect(widthViolations(f)).toEqual([]);
    expect(footprintSize(openingOf(f))).toBe(9);
  });

  it('straight-edged rectangles pass', () => {
    for (const [w, h] of [[3, 3], [3, 9], [7, 3], [12, 8], [120, 80]] as const) {
      expect(widthViolations(footprintFromTiles(rect(w, h)))).toEqual([]);
    }
  });

  it('2xN strips fail entirely, 1xN too', () => {
    expect(widthViolations(footprintFromTiles(rect(2, 5)))).toHaveLength(10);
    expect(widthViolations(footprintFromTiles(rect(6, 2)))).toHaveLength(12);
    expect(keys(widthViolations(footprintFromTiles(rect(1, 3))))).toEqual(['0,0', '0,1', '0,2']);
  });

  it('a 3x2 block fails fully', () => {
    expect(widthViolations(footprintFromTiles(rect(3, 2)))).toHaveLength(6);
  });

  it('a 1-wide spine off a body fails exactly on the spine', () => {
    const f = footprintFromTiles(shape([
      '..#..',
      '..#..',
      '#####',
      '#####',
      '#####',
    ]));
    expect(keys(widthViolations(f))).toEqual(['2,0', '2,1']);
  });

  it('a 2-wide stub off a body fails on the stub', () => {
    const f = footprintFromTiles(shape([
      '.##.',
      '.##.',
      '####',
      '####',
      '####',
    ]));
    // The stub's two rows are dropped. Row 2 (the join) is covered by the 3x3 square rows 2-4 x 0-2.
    expect(keys(widthViolations(f))).toEqual(['1,0', '2,0', '1,1', '2,1']);
  });

  it('a 1-tile corner notch keeps the rule (the shape stays solid around it)', () => {
    const f = footprintFromTiles(shape([
      '.####',
      '#####',
      '#####',
      '#####',
    ]));
    expect(widthViolations(f)).toEqual([]);
  });

  it('a 1-wide notch (slot) cut into a body leaves 1-wide fingers that fail', () => {
    const f = footprintFromTiles(shape([
      '#.#',
      '#.#',
      '#.#',
    ]));
    expect(widthViolations(f)).toHaveLength(6);
    // A slot in a wide body: the body edge rows stay, no tile fails because every tile lies in some full 3x3.
    const body = footprintFromTiles(shape([
      '####.####',
      '####.####',
      '#########',
      '#########',
      '#########',
    ]));
    expect(widthViolations(body)).toEqual([]);
  });

  it('a hole-free slot leaving a 2-wide finger fails on the finger', () => {
    const f = footprintFromTiles(shape([
      '###.##',
      '###.##',
      '######',
      '######',
      '######',
    ]));
    expect(keys(widthViolations(f))).toEqual(['4,0', '5,0', '4,1', '5,1']);
  });

  describe('45 degree chamfers', () => {
    it('1-step staircase (one tile per row) survives on a big shape', () => {
      const f = footprintFromTiles(shape([
        '...#########',
        '..##########',
        '.###########',
        '############',
        '############',
        '############',
        '############',
      ]));
      expect(widthViolations(f)).toEqual([]);
    });

    it('2-step staircase (two tiles per row) survives on a big shape', () => {
      const f = footprintFromTiles(shape([
        '......########',
        '....##########',
        '..############',
        '##############',
        '##############',
        '##############',
      ]));
      expect(widthViolations(f)).toEqual([]);
    });

    it('all four corners chamfered by 1- and 2-steps pass', () => {
      for (const c of [3, 4, 5]) {
        const tiles: TileXY[] = [];
        for (let y = 0; y < 14; y++) {
          for (let x = 0; x < 20; x++) {
            const dx = Math.min(x, 19 - x);
            const dy = Math.min(y, 13 - y);
            if (dx + dy >= c) tiles.push({ x, y });
          }
        }
        expect(widthViolations(footprintFromTiles(tiles))).toEqual([]);
      }
    });

    it('a 1-wide diagonal line fails', () => {
      const f = footprintFromTiles(Array.from({ length: 8 }, (_, i) => ({ x: i, y: i })));
      expect(widthViolations(f)).toHaveLength(8);
    });

    it('a staircase edge only 2 tiles deep (thin diagonal band) fails', () => {
      // Band of 2 tiles per row slanting down-right.
      const tiles: TileXY[] = [];
      for (let y = 0; y < 8; y++) tiles.push({ x: y, y }, { x: y + 1, y });
      expect(widthViolations(footprintFromTiles(tiles)).length).toBeGreaterThan(0);
    });
  });

  describe('changes', () => {
    const body = footprintFromTiles(rect(5, 5));

    it('adding a 1-wide spine reports exactly the added tiles', () => {
      const v = widthViolations(body, { add: [{ x: 2, y: -1 }, { x: 2, y: -2 }] });
      expect(keys(v)).toEqual(['2,-2', '2,-1']);
    });

    it('adding a 3-wide block passes', () => {
      expect(widthViolations(body, { add: rect(3, 3).map((t) => ({ x: t.x + 5, y: t.y + 1 })) })).toEqual([]);
    });

    it('adding a 2-wide extension fails on it', () => {
      const v = widthViolations(body, { add: [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 6, y: 1 }, { x: 6, y: 2 }] });
      expect(keys(v)).toEqual(['5,1', '6,1', '5,2', '6,2']);
    });

    it('removing the middle row of a 5x5 leaves two 2-high strips that fail', () => {
      const v = widthViolations(body, { remove: rect(5, 1).map((t) => ({ x: t.x, y: 2 })) });
      expect(v).toHaveLength(20);
    });

    it('removing a corner tile keeps the rule', () => {
      expect(widthViolations(body, { remove: [{ x: 0, y: 0 }] })).toEqual([]);
    });

    it('removing a row so a column of 1 tile remains reports it', () => {
      const v = widthViolations(footprintFromTiles(rect(4, 4)), { remove: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }] });
      // left: column x=0 rows 0-1 (1 wide) + 4x2 block rows 2-3 (2 high): everything fails
      expect(v).toHaveLength(10);
    });

    it('does not mutate the input and removal wins over add', () => {
      const before = footprintSize(body);
      const f = applyChange(body, { add: [{ x: 9, y: 9 }], remove: [{ x: 9, y: 9 }] });
      expect(footprintHas(f, 9, 9)).toBe(false);
      expect(footprintSize(body)).toBe(before);
      expect(widthOk(body, { add: [{ x: 9, y: 9 }], remove: [{ x: 9, y: 9 }] })).toBe(true);
    });
  });

  it('reads a ship footprint from the grid, filtered by owner', () => {
    const g = new DenseGrid(1, 10, 6, SHIP_FIELDS);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        g.set('struct', x, y, Struct.Floor);
        g.set('ship', x, y, 7);
      }
    }
    g.set('struct', 5, 5, Struct.Beam); // a strut is not hull
    g.set('ship', 5, 5, 7);
    g.set('struct', 6, 1, Struct.Wall);
    g.set('ship', 6, 1, 8);
    const f7 = footprintFromGrid(g, 7);
    expect(footprintSize(f7)).toBe(9);
    expect(widthViolations(f7)).toEqual([]);
    const all = footprintFromGrid(g);
    expect(footprintSize(all)).toBe(10);
    expect(widthViolations(all)).toHaveLength(1);
  });

  it('handles a 120x80 footprint with a change', () => {
    const f = footprintFromTiles(rect(120, 80));
    expect(keys(widthViolations(f, { add: [{ x: 60, y: -1 }] }))).toEqual(['60,-1']);
  });
});
