import { describe, expect, it } from 'vitest';
import { Grid, type GridLike } from './grid';
import { GridWindow } from './gridWindow';
import { initAtmosphere } from './ship';
import { SectorGrid } from './sectorGrid';
import { bordersSpace, isEvaWalkable, SHIP_EMPTY, SHIP_FIELDS, Struct, writeStruct } from './structure';

const ROWS = ['..####..', '.#__D_#.', '##____##', '#_.._D_#', '########'];
const CHARS: Record<string, number> = { '.': Struct.Space, '#': Struct.Wall, _: Struct.Floor, D: Struct.Door };

/** Stamp an ASCII template onto any grid from its top-left (x0, y0) the way gridFromTemplate does, then vary a few fields. */
function stamp(g: GridLike): void {
  const { x0, y0 } = g;
  ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const kind = CHARS[row[x] as string] as number;
      if (kind !== Struct.Space) writeStruct(g, x0 + x, y0 + y, kind);
    }
  });
  for (let y = 0; y < g.height; y++) for (let x = 0; x < g.width; x++) initAtmosphere(g, x0 + x, y0 + y);
  g.set('fire', x0 + 3, y0 + 2, 90);
  g.set('smoke', x0 + 3, y0 + 2, 12);
  g.set('module', x0 + 4, y0 + 2, 9);
  g.set('room', x0 + 4, y0 + 2, 1);
  g.set('o2', x0 + 4, y0 + 2, 17.5);
  g.set('door', x0 + 4, y0 + 1, 255);
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
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) expect(win.get(f, ox + x, oy + y), `${f} ${x},${y}`).toBe(grid.get(f, x, y));
        expect(Array.from(win.raw(f))).toEqual(Array.from(grid.raw(f)));
      }
      for (let y = -1; y <= H; y++) {
        for (let x = -1; x <= W; x++) {
          expect(win.inBounds(ox + x, oy + y)).toBe(grid.inBounds(x, y));
          if (!grid.inBounds(x, y)) continue;
          expect(isEvaWalkable(win, ox + x, oy + y)).toBe(isEvaWalkable(grid, x, y));
          expect(bordersSpace(win, ox + x, oy + y)).toBe(bordersSpace(grid, x, y));
        }
      }
      expect(win.fieldNames()).toEqual(grid.fieldNames());
    });
  }

  it('reads sector coordinates, bounds-checks its rectangle and writes through to the sector', () => {
    const { win, sector } = pair(-37, 21);
    expect([win.x0, win.y0]).toEqual([-37, 21]);
    expect(() => win.get('struct', -37 + W, 21)).toThrow(RangeError);
    expect(() => win.set('struct', -38, 21, 1)).toThrow(RangeError);
    expect(() => win.get('struct', 0, 0)).toThrow(RangeError);
    expect(sector.get('struct', -37, 21)).toBe(Struct.Space);
    expect(sector.get('struct', -35, 21)).toBe(Struct.Wall);
    win.set('hp', -36, 22, 33);
    expect(sector.get('hp', -36, 22)).toBe(33);
    sector.set('hp', -36, 22, 34);
    expect(win.get('hp', -36, 22)).toBe(34);
  });

  it('sums chunk revisions and refreshes the cached raw copy', () => {
    const sector = new SectorGrid(9, SHIP_FIELDS, SHIP_EMPTY);
    const win = new GridWindow(1, sector, -8, -8, 20, 20); // straddles chunks (-1..1)
    expect(win.revision('struct')).toBe(0);
    win.set('struct', -8, -8, Struct.Wall);
    win.set('struct', 11, 11, Struct.Wall);
    expect(win.revision('struct')).toBe(2);
    sector.set('struct', 100, 100, Struct.Wall); // outside the window
    expect(win.revision('struct')).toBe(2);
    expect(win.revision('o2')).toBe(0);
    expect(win.chunkRevision('struct', -1, -1)).toBeGreaterThan(0);
    expect(() => win.chunkRevision('struct', 0, -1)).not.toThrow();
    expect(() => win.chunkRevision('struct', 1, 0)).toThrow(RangeError);
    const a = win.raw('struct');
    expect(a[0]).toBe(Struct.Wall);
    expect(win.raw('struct')).toBe(a); // cached
    win.set('struct', -3, -3, Struct.Floor);
    const b = win.raw('struct');
    expect(b[5 * 20 + 5]).toBe(Struct.Floor);
    // clearing every solid tile releases chunks; revision still moves forward
    const r = win.revision('struct');
    win.set('struct', -8, -8, Struct.Space);
    expect(win.revision('struct')).toBeGreaterThan(r);
  });
});
