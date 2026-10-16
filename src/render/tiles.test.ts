import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { isLowered, wallChain } from "./tiles";

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
  it("hull wall is one block, low variant first when cut away", () => {
    expect(wallChain(k, 0, 0, W, false)).toEqual(["tile.hull", "tile.wall"]);
    expect(wallChain(k, 1, 2, W, true)[0]).toBe("tile.hull.low");
  });
  it("interior walls use the plain wall block", () => {
    const big = grid([
      [W, W, W, W, W],
      [W, F, F, F, W],
      [W, F, W, F, W],
      [W, F, F, F, W],
      [W, W, W, W, W],
    ]);
    expect(wallChain(big, 2, 2, W, false)[0]).toBe("tile.wall");
  });
  it("doors run along the wall axis", () => {
    const d = grid([
      [W, W, W],
      [W, F, W],
      [W, Struct.Door, W],
    ]);
    expect(wallChain(d, 1, 2, Struct.Door, false)[0]).toBe("tile.door.x");
    expect(wallChain(d, 1, 2, Struct.Door, true)[0]).toBe("tile.door.low.x");
  });
  it("lowers walls with interior behind them", () => {
    expect(isLowered(k, 1, 2, "auto")).toBe(true);
    expect(isLowered(k, 1, 0, "auto")).toBe(false);
  });
});
