import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { isLowered, wallPieces } from "./tiles";

const W = Struct.Wall;
const F = Struct.Floor;
const S = Struct.Space;
const grid = (rows: number[][]) => (x: number, y: number) => rows[y]?.[x] ?? S;

describe("tile chains", () => {
  const k = grid([
    [W, W, W],
    [W, F, W],
    [W, W, W],
  ]);
  const ids = (
    kindAt: (x: number, y: number) => number,
    x: number,
    y: number,
    kind: number,
    low: boolean,
  ) =>
    wallPieces(kindAt, x, y, kind, low)
      .sort((a, b) => a.order - b.order)
      .map((p) => (p.chain[0] as string).replace(/^tile\./, ""));

  it("hull corner: base then upper, centre plus arms toward s and e", () => {
    expect(ids(k, 0, 0, W, false)).toEqual([
      "hull.base.c",
      "hull.base.arm.s",
      "hull.base.arm.e",
      "hull.upper.c",
      "hull.upper.arm.s",
      "hull.upper.arm.e",
    ]);
  });
  it("arms draw back (n, w) before the centre and front (s, e) after", () => {
    const big = grid([
      [S, S, S, S, S],
      [S, W, W, W, S],
      [S, W, F, W, S],
      [S, W, W, W, S],
      [S, S, S, S, S],
    ]);
    const base = (x: number, y: number) =>
      ids(big, x, y, W, false).filter((i) => i.startsWith("hull.base"));
    expect(base(1, 1)).toEqual([
      "hull.base.c",
      "hull.base.arm.s",
      "hull.base.arm.e",
    ]);
    expect(base(2, 1)).toEqual([
      "hull.base.arm.w",
      "hull.base.c",
      "hull.base.arm.e",
    ]);
  });
  it("cutaway keeps the base and swaps the upper wall for the stub", () => {
    const low = ids(k, 1, 2, W, true);
    expect(low.some((i) => i.includes("base"))).toBe(true);
    expect(low.some((i) => i.includes("upper.low"))).toBe(true);
    expect(low.some((i) => /upper\.(c|arm)/.test(i))).toBe(false);
  });
  it("doors draw a sill and a frame, never wall base or upper pieces, whatever the cutaway", () => {
    const d = grid([
      [W, W, W],
      [W, F, W],
      [W, Struct.Door, W],
    ]);
    for (const low of [false, true]) {
      expect(ids(d, 1, 2, Struct.Door, low)).toEqual(["door.sill.x", "door.x"]);
    }
  });
  it("lowers walls with interior behind them", () => {
    expect(isLowered(k, 1, 2, "auto")).toBe(true);
    expect(isLowered(k, 1, 0, "auto")).toBe(false);
  });
});
