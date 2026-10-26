import { describe, expect, it } from 'vitest';
import { newOps, parsePoints, pixelArrow, pixelDiamond, pixelDiamondRing, pixelLine, pixelOutline, pixelSquare, rectBorder, type Ops, type PixelLineOpts } from './pixel';

/** The cell rects of some ops, as [x, y, w, h] in cells. */
function rects(o: Ops, g: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < o.r.length; i += 4) out.push([o.r[i]! / g, o.r[i + 1]! / g, o.r[i + 2]! / g, o.r[i + 3]! / g]);
  return out;
}
const area = (o: Ops, g: number) => rects(o, g).reduce((a, [, , w, h]) => a + w * h, 0);
const line = (ax: number, ay: number, bx: number, by: number, g: number, opt?: PixelLineOpts) => {
  const o = newOps();
  pixelLine(o, ax, ay, bx, by, g, opt);
  return o;
};

describe('starmap pixel lines', () => {
  const g = 2;

  it('draws a straight line as one run of cells', () => {
    expect(rects(line(0, 0, 20, 0, g), g)).toEqual([[-0.5, -0.5, 11, 1]]);
    expect(rects(line(0, 0, 0, 20, g, { w: 2 }), g)).toEqual([[-0.5, -0.5, 2, 11]]);
  });

  it('draws a 45° line as one cell per step, and an odd angle with no gaps or doubled cells', () => {
    expect(rects(line(0, 0, 20, 20, g), g)).toHaveLength(11);
    // A line from cell 0 to cell 37 along its major axis covers 38 cells, one per column.
    const o = line(0, 0, 74, 30, g);
    expect(area(o, g)).toBe(38);
    const cols = rects(o, g).flatMap(([x, , w]) => Array.from({ length: w }, (_, i) => x + 0.5 + i));
    expect(cols).toEqual(Array.from({ length: 38 }, (_, i) => i));
  });

  it('dashes in cells along the line', () => {
    expect(area(line(0, 0, 38, 0, g, { dash: [2, 3] }), g)).toBe(8);
  });

  it('falls back to a band for a line of thousands of cells', () => {
    const o = line(0, 0, 100000, 0, g);
    expect(o.r).toHaveLength(0);
    expect(o.q).toHaveLength(1);
  });

  it('draws a closed outline, cached', () => {
    const d = 'M0 0L20 0L20 20L0 20Z';
    expect(pixelOutline(d, g)).toBe(pixelOutline(d, g));
    expect(area(pixelOutline(d, g), g)).toBeGreaterThanOrEqual(40);
  });

  it('snaps squares to the cells and arrows to eight headings', () => {
    expect(pixelSquare(5, 5, 4, g)).toEqual({ x: 1, y: 1, width: 10, height: 10 });
    const arrow = (a: number) => {
      const o = newOps();
      pixelArrow(o, a, g);
      return o;
    };
    expect(arrow(10).r).toEqual(arrow(0).r);
    for (let a = 0; a < 360; a += 45) expect(area(arrow(a), g)).toBeGreaterThan(6);
  });

  it('draws a diamond and its ring on the same cells', () => {
    const d = newOps();
    pixelDiamond(d, 0, 0, 10, g);
    const r = newOps();
    pixelDiamondRing(r, 0, 0, 10, g);
    expect(area(d, g)).toBe(61);
    expect(area(r, g)).toBe(20);
  });

  it('reads route points and borders a rectangle', () => {
    expect(parsePoints('1,2 3.5,4')).toEqual([1, 2, 3.5, 4]);
    const o = newOps();
    rectBorder(o, 0, 0, 10, 10, 1);
    expect(area(o, 1)).toBe(36);
  });
});

describe('starmap dashed lines', () => {
  it('draws every dash of a line in one shape, at a clean slope', () => {
    const g = 2;
    // Slope 0.55: each two-cell dash is drawn at 1/2, so all have the same offsets from their first cell.
    const r = rects(line(0, 0, 200, 110, g, { dash: [2, 3] }), g);
    const shapes = new Set<string>();
    for (let i = 0; i + 1 < r.length; i += 2) shapes.add(`${r[i + 1]![0] - r[i]![0]},${r[i + 1]![1] - r[i]![1]}`);
    expect(shapes.size).toBe(1);
  });
});
