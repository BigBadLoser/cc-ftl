import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { decodeWindow, windowCode } from "../sim/windows";
import { exteriorIds, hullKeys } from "./hullArt";
import { wallPieces } from "./tiles";

const W = Struct.Wall;
const F = Struct.Floor;
const S = Struct.Space;
const grid = (rows: number[][]) => (x: number, y: number) => rows[y]?.[x] ?? S;
const win = (axis: "x" | "y", size: number, index: number) => decodeWindow(windowCode(axis, size, index));
const first = (kindAt: (x: number, y: number) => number, x: number, y: number, w: ReturnType<typeof win>, mode: "up" | "auto" = "up") =>
  wallPieces(kindAt, x, y, W, mode, true, () => false, w)[0]!.chain;

describe("window wall pieces (walls up)", () => {
  // A room with a partition along x at y = 3 (x 1..6) and one along y at x = 8 (y 1..6), hull round it.
  const k = grid([
    [S, S, S, S, S, S, S, S, S, S],
    [S, W, W, W, W, W, W, W, W, W],
    [S, W, F, F, F, F, F, F, W, W],
    [S, W, F, F, F, F, F, F, W, W],
    [S, W, F, F, F, F, F, F, W, W],
    [S, W, W, W, W, W, W, W, W, W],
    [S, S, S, S, S, S, S, S, S, S],
  ]);
  const part = grid([
    [S, W, W, W, W, W, W, W, S, S],
    [S, W, F, F, F, F, F, F, W, S],
    [S, W, W, W, W, W, W, W, W, S],
    [S, W, F, F, F, F, F, F, W, S],
    [S, W, W, W, W, W, W, W, W, S],
    [S, S, S, S, S, S, S, S, S, S],
  ]);

  it("a partition tile takes l / m / r by its index along the run, axis x", () => {
    expect([0, 1, 2].map((i) => first(part, 2 + i, 2, win("x", 3, i))[0])).toEqual(["tile.wall.full.m10.win.l", "tile.wall.full.m10.win.m", "tile.wall.full.m10.win.r"]);
    expect([0, 1, 2, 3].map((i) => first(part, 2 + i, 2, win("x", 4, i))[0]?.slice(-1))).toEqual(["l", "m", "m", "r"]);
    expect([0, 1].map((i) => first(part, 2 + i, 2, win("x", 2, i))[0]?.slice(-1))).toEqual(["l", "r"]);
  });
  it("the plain piece follows as the fallback, and no window means no window id", () => {
    const c = first(part, 3, 2, win("x", 3, 1));
    expect(c[c.length - 1]).toBe("tile.wall.full.m10");
    expect(first(part, 3, 2, null)[0]).toBe("tile.wall.full.m10");
  });
  it("along y uses m5; a window of the other axis or a corner gets no window id", () => {
    const col = grid([
      [S, S, S, S, S, S],
      [S, W, W, W, W, S],
      [S, W, F, W, F, S],
      [S, W, F, W, F, S],
      [S, W, F, W, F, S],
      [S, W, W, W, W, S],
      [S, S, S, S, S, S],
    ]);
    expect(first(col, 3, 2, win("y", 2, 0))[0]).toBe("tile.wall.full.m5.win.l");
    expect(first(col, 3, 3, win("y", 2, 1))[0]).toBe("tile.wall.full.m5.win.r");
    expect(first(col, 3, 2, win("x", 2, 0)).some((id) => id.includes(".win."))).toBe(false);
    expect(first(col, 3, 1, win("y", 2, 0)).some((id) => id.includes(".win."))).toBe(false); // a T junction (mask 14)
  });
  it("the far hull keeps its cap over the window piece at every level; cutaway partitions stay plain", () => {
    const pieces = wallPieces(k, 3, 1, W, "up", true, () => false, win("x", 2, 0));
    expect(pieces[0]!.chain[0]).toBe("tile.wall.full.m10.win.l");
    expect(pieces[1]!.chain[0]).toBe("tile.hull.cap.m10");
    // the far hull stays full height in the cutaway, so its window shows there too
    expect(wallPieces(k, 3, 1, W, "auto", true, () => false, win("x", 2, 0))[0]!.chain[0]).toBe("tile.wall.full.m10.win.l");
    expect(first(part, 3, 2, win("x", 2, 0), "auto").some((id) => id.includes(".win."))).toBe(false);
  });
  it("the near hull stays the ghost (no window)", () => {
    const pieces = wallPieces(k, 3, 5, W, "up", true, () => false, win("x", 2, 0));
    expect(pieces).toHaveLength(2);
    expect(pieces.every((p) => p.chain.every((id) => !id.includes(".win.")))).toBe(true);
  });
});

describe("window exterior pieces (roofed)", () => {
  const w = 9, h = 6;
  const kindAt = (x: number, y: number) => (x < 1 || y < 1 || x > w || y > h ? S : x === 1 || y === 1 || x === w || y === h ? W : F);
  const keys = hullKeys(kindAt, w + 2, h + 2)!;
  const all = () => true;
  it("near run along x: w1 at the lower end, w2 in the middle, w3 at the higher", () => {
    expect([3, 4, 5, 6].map((x) => exteriorIds(keys, x, h, all, false, win("x", 4, x - 3)))).toEqual([
      ["tile.hull.ext.o1.m10.w1"], ["tile.hull.ext.o1.m10.w2"], ["tile.hull.ext.o1.m10.w2"], ["tile.hull.ext.o1.m10.w3"],
    ]);
  });
  it("near run along y uses o2.m5", () => {
    expect([2, 3, 4].map((y) => exteriorIds(keys, w, y, all, false, win("y", 3, y - 2))![0])).toEqual([
      "tile.hull.ext.o2.m5.w1", "tile.hull.ext.o2.m5.w2", "tile.hull.ext.o2.m5.w3",
    ]);
  });
  it("falls back to the design pick without the art, and the far hull and corners draw as now", () => {
    const noWin = (id: string) => !id.includes(".w");
    expect(exteriorIds(keys, 4, h, noWin, false, win("x", 2, 0))![0]).toMatch(/^tile\.hull\.ext\.o1\.m10(\.a[123])?$/);
    expect(exteriorIds(keys, 4, 1, all, false, win("x", 2, 0))).toEqual(exteriorIds(keys, 4, 1, all));
    expect(exteriorIds(keys, w, h, all, false, win("x", 2, 0))).toEqual(exteriorIds(keys, w, h, all));
    expect(exteriorIds(keys, 4, h, all, true, win("x", 2, 0))).toEqual(exteriorIds(keys, 4, h, all, true));
  });
});
