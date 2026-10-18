import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { floorChain, tileHash, wallMask, wallPieces, type CutawayMode } from "./tiles";

const W = Struct.Wall;
const F = Struct.Floor;
const S = Struct.Space;
const D = Struct.Door;
const grid = (rows: number[][]) => (x: number, y: number) => rows[y]?.[x] ?? S;
const ids = (
  k: (x: number, y: number) => number,
  x: number,
  y: number,
  kind: number,
  mode: CutawayMode,
  ghosts = true,
) =>
  wallPieces(k, x, y, kind, mode, ghosts).map((p) =>
    (p.chain[0] as string).replace(/^tile\./, "").replace(/\.v\d$/, ""),
  );

describe("wall autotiling", () => {
  const ring = grid([
    [S, S, S, S, S],
    [S, W, W, W, S],
    [S, W, F, W, S],
    [S, W, W, W, S],
    [S, S, S, S, S],
  ]);
  it("builds the mask from wall, hull and door neighbours", () => {
    expect(wallMask(ring, 1, 1)).toBe(2 | 4);
    expect(wallMask(ring, 2, 1)).toBe(2 | 8);
    expect(wallMask(ring, 1, 2)).toBe(1 | 4);
    const d = grid([[W, D, W]]);
    expect(wallMask(d, 0, 0)).toBe(2);
    expect(wallMask(d, 2, 0)).toBe(8);
  });
  it("an isolated wall is mask 0 and an interior wall is not hull", () => {
    expect(ids(grid([[F, F, F], [F, W, F], [F, F, F]]), 1, 1, W, "auto")).toEqual(["wall.m0"]);
  });
  it("ghosts only exterior hull tiles whose +x or +y neighbour is space", () => {
    expect(ids(ring, 2, 3, W, "auto")).toEqual(["hull.ghost.m10"]);
    expect(ids(ring, 3, 2, W, "auto")).toEqual(["hull.ghost.m5"]);
    expect(ids(ring, 2, 1, W, "auto")).toEqual(["hull.m10"]);
    expect(ids(ring, 1, 2, W, "auto")).toEqual(["hull.m5"]);
  });
  it("ghosts off draws the front hull as a normal piece with a hazard strip", () => {
    expect(ids(ring, 2, 3, W, "down", false)).toEqual(["hull.m10", "hull.haz.s.3"]);
    expect(ids(ring, 3, 2, W, "down", false)).toEqual(["hull.m5", "hull.haz.e.3"]);
  });
  it("up mode uses full-height pieces except for ghosts; down and auto use low blocks", () => {
    expect(ids(ring, 2, 1, W, "up")).toEqual(["hull.full.m10"]);
    expect(ids(ring, 2, 3, W, "up")).toEqual(["hull.ghost.m10"]);
    expect(ids(ring, 2, 1, W, "down")).toEqual(["hull.m10"]);
  });
  it("doors orient along x between walls in x, otherwise y, with no wall piece", () => {
    expect(ids(grid([[W, D, W]]), 1, 0, D, "auto")).toEqual(["door.low.x"]);
    expect(ids(grid([[W, D, W]]), 1, 0, D, "up")).toEqual(["door.x"]);
    expect(ids(grid([[W], [D], [W]]), 0, 1, D, "auto")).toEqual(["door.low.y"]);
  });
});

describe("floors", () => {
  it("picks a variant per tile deterministically", () => {
    expect(floorChain(3, 4)).toEqual(floorChain(3, 4));
    const set = new Set<string>();
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) set.add(floorChain(x, y)[0] as string);
    expect(set.size).toBeLessThanOrEqual(3);
    expect([...set].filter((v) => v === "tile.floor.a").length).toBe(1);
    expect(tileHash(1, 2)).toBe(tileHash(1, 2));
  });
});
