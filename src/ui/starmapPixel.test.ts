import { describe, expect, it } from 'vitest';
import { pixelArrow, pixelLine, pixelOutline, pixelSquare } from './starmapPixel';

/** The cell rects of a pixel path, as [x, y, w, h] in cells. */
function rects(d: string, g: number): [number, number, number, number][] {
  return [...d.matchAll(/M(-?[\d.]+) (-?[\d.]+)h(-?[\d.]+)v(-?[\d.]+)h-?[\d.]+Z/g)].map((m) => [+m[1]! / g, +m[2]! / g, +m[3]! / g, +m[4]! / g]);
}
const area = (d: string, g: number) => rects(d, g).reduce((a, [, , w, h]) => a + w * h, 0);

describe('starmap pixel lines', () => {
  const g = 2;

  it('draws a straight line as one run of cells', () => {
    expect(rects(pixelLine(0, 0, 20, 0, g), g)).toEqual([[-0.5, -0.5, 11, 1]]);
    expect(rects(pixelLine(0, 0, 0, 20, g, { w: 2 }), g)).toEqual([[-0.5, -0.5, 2, 11]]);
  });

  it('draws a 45° line as one cell per step, and an odd angle with no gaps or doubled cells', () => {
    expect(rects(pixelLine(0, 0, 20, 20, g), g)).toHaveLength(11);
    // A line from cell 0 to cell 37 along its major axis covers 38 cells, one per column.
    const d = pixelLine(0, 0, 74, 30, g);
    expect(area(d, g)).toBe(38);
    const cols = rects(d, g).flatMap(([x, , w]) => Array.from({ length: w }, (_, i) => x + 0.5 + i));
    expect(cols).toEqual(Array.from({ length: 38 }, (_, i) => i));
  });

  it('dashes in cells along the line', () => {
    expect(area(pixelLine(0, 0, 38, 0, g, { dash: [2, 3] }), g)).toBe(8);
  });

  it('draws a closed outline, cached', () => {
    const d = 'M0 0L20 0L20 20L0 20Z';
    expect(pixelOutline(d, g)).toBe(pixelOutline(d, g));
    expect(area(pixelOutline(d, g), g)).toBeGreaterThanOrEqual(40);
  });

  it('snaps squares to the cells and arrows to eight headings', () => {
    expect(pixelSquare(5, 5, 4, g)).toEqual({ x: 1, y: 1, width: 10, height: 10 });
    expect(pixelArrow(10, g)).toBe(pixelArrow(0, g));
    for (let a = 0; a < 360; a += 45) expect(area(pixelArrow(a, g), g)).toBeGreaterThan(6);
  });
});
