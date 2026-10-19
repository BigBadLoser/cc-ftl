import { describe, expect, it } from 'vitest';
import { Grid, type GridLike } from './grid';
import { GridWindow } from './gridWindow';
import { initAtmosphere } from './ship';
import { SectorGrid } from './sectorGrid';
import { bordersSpace, isEvaWalkable, SHIP_EMPTY, SHIP_FIELDS, Struct, writeStruct } from './structure';

const ROWS = ['..####..', '.#__D_#.', '##____##', '#_.._D_#', '########'];
const CHARS: Record<string, number> = { '.': Struct.Space, '#': Struct.Wall, _: Struct.Floor, D: Struct.Door };

/** Stamp an ASCII template onto any grid the way gridFromTemplate does, then vary a few other fields. */
function stamp(g: GridLike): void {
  ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const kind = CHARS[row[x] as string] as number;
      if (kind !== Struct.Space) writeStruct(g, x, y, kind);
    }
  });
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) initAtmosphere(g, x, y);
  g.set('fire', 3, 2, 90);
  g.set('smoke', 3, 2, 12);
  g.set('module', 4, 2, 9);
  g.set('room', 4, 2, 1);
  g.set('o2', 4, 2, 17.5);
  g.set('door', 4, 1, 255);
}

const W = 8;
const H = 5;

function pair(ox: number, oy: number): { grid: Grid; win: GridWindow; sector: SectorGrid } {
  const grid = new Grid(1, W, H, SHIP_FIELDS);
  const sector = new SectorGrid(9, SHIP_FIELDS, SHIP_EMPTY);
  const win = new GridWindow(1, sector, ox, oy, W, H);
  stamp(grid);
  stamp(win);
  return { grid, win, sector };
}

describe('GridWindow', () => {
  for (const [ox, oy] of [[0, 0], [-37, 21], [13, -5]] as const) {
    it(`matches a Grid for a stamped template at offset (${ox}, ${oy})`, () => {
      const { grid, win } = pair(ox, oy);
      for (const f of Object.keys(SHIP_FIELDS)) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(win.get(f, x, y), `${f} ${x},${y}`).toBe(grid.get(f, x, y));
        expect(Array.from(win.raw(f))).toEqual(Array.from(grid.raw(f)));
      }
      for (let y = -1; y <= H; y++) {
        for (let x = -1; x <= W; x++) {
          expect(win.inBounds(x, y)).toBe(grid.inBounds(x, y));
          if (!grid.inBounds(x, y)) continue;
          expect(isEvaWalkable(win, x, y)).toBe(isEvaWalkable(grid, x, y));
          expect(bordersSpace(win, x, y)).toBe(bordersSpace(grid, x, y));
        }
      }
      expect(win.fieldNames()).toEqual(grid.fieldNames());
    });
  }

  it('bounds-checks in local coordinates and writes through to the sector', () => {
    const { win, sector } = pair(-37, 21);
    expect(() => win.get('struct', W, 0)).toThrow(RangeError);
    expect(() => win.set('struct', -1, 0, 1)).toThrow(RangeError);
    expect(sector.get('struct', -37, 21)).toBe(Struct.Space);
    expect(sector.get('struct', -35, 21)).toBe(Struct.Wall);
    win.set('hp', 1, 1, 33);
    expect(sector.get('hp', -36, 22)).toBe(33);
    sector.set('hp', -36, 22, 34);
    expect(win.get('hp', 1, 1)).toBe(34);
  });

  it('sums chunk revisions and refreshes the cached raw copy', () => {
    const sector = new SectorGrid(9, SHIP_FIELDS, SHIP_EMPTY);
    const win = new GridWindow(1, sector, -8, -8, 20, 20); // straddles chunks (-1..1)
    expect(win.revision('struct')).toBe(0);
    win.set('struct', 0, 0, Struct.Wall);
    win.set('struct', 19, 19, Struct.Wall);
    expect(win.revision('struct')).toBe(2);
    sector.set('struct', 100, 100, Struct.Wall); // outside the window
    expect(win.revision('struct')).toBe(2);
    expect(win.revision('o2')).toBe(0);
    expect(win.chunkRevision('struct', 0, 0)).toBeGreaterThan(0);
    expect(() => win.chunkRevision('struct', 2, 0)).toThrow(RangeError);
    const a = win.raw('struct');
    expect(a[0]).toBe(Struct.Wall);
    expect(win.raw('struct')).toBe(a); // cached
    win.set('struct', 5, 5, Struct.Floor);
    const b = win.raw('struct');
    expect(b[5 * 20 + 5]).toBe(Struct.Floor);
    // clearing every solid tile releases chunks; revision still moves forward
    const r = win.revision('struct');
    win.set('struct', 0, 0, Struct.Space);
    expect(win.revision('struct')).toBeGreaterThan(r);
  });
});
