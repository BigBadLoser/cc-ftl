import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { floorChain, outward, replacesFloor, tileHash, wallMask, wallPieces, type CutawayMode } from "./tiles";

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
  it("the near hull is a ghost in every level, by its outward side", () => {
    for (const mode of ["up", "auto", "down"] as const) {
      expect(ids(ring, 2, 3, W, mode)).toEqual(["hull.o1.m10", "hull.belly.o1.m10"]);
      expect(ids(ring, 3, 2, W, mode)).toEqual(["hull.o2.m5", "hull.belly.o2.m5"]);
      expect(ids(ring, 3, 3, W, mode)).toEqual(["hull.o3.m9", "hull.belly.o3.m9"]);
    }
    expect(ids(ring, 3, 1, W, "up")).toEqual(["hull.o2.m12", "hull.belly.o2.m12"]);
    expect(wallPieces(ring, 2, 3, W, "up").map((q) => !!q.under)).toEqual([false, true]);
  });
  it("the far hull is full in up and cut, a ghost rim in low", () => {
    expect(ids(ring, 2, 1, W, "up")).toEqual(["hull.full.m10", "hull.full.end.e"]);
    expect(ids(ring, 2, 1, W, "auto")).toEqual(["hull.m10", "hull.end.e"]);
    expect(ids(ring, 2, 1, W, "down")).toEqual(["hull.ghost.m10"]);
    expect(ids(grid([[S, S, S, S], [S, F, F, S], [S, F, W, W], [S, S, W, W]]), 2, 2, W, "down")).toEqual(["hull.ghost.m6.r9"]);
    expect(ids(ring, 1, 1, W, "down")).toEqual(["hull.ghost.m6"]);
    expect(ids(ring, 2, 1, W, "up", false)).toEqual(["hull.full.m10"]);
    expect(ids(ring, 2, 3, W, "auto", false)).toEqual(["hull.m10"]);
  });
  it("partitions use the level's piece and an end face where they butt into a ghost", () => {
    const room = grid([
      [S, S, S, S, S],
      [S, W, W, W, S],
      [S, W, F, W, S],
      [S, W, W, W, S],
      [S, W, F, W, S],
      [S, W, W, W, S],
      [S, S, S, S, S],
    ]);
    expect(ids(grid([[F, F, F], [F, W, F], [F, F, F]]), 1, 1, W, "up")).toEqual(["wall.full.m0"]);
    expect(ids(grid([[F, F, F], [F, W, F], [F, F, F]]), 1, 1, W, "down")).toEqual(["wall.low.m0"]);
    expect(ids(room, 2, 3, W, "auto")).toEqual(["wall.m10", "wall.end.e"]);
    expect(ids(room, 2, 1, W, "up")).toEqual(["hull.full.m10", "hull.full.end.e"]);
  });
  it("hull plating uses the ochre-panel variant on every third diagonal", () => {
    expect(wallPieces(ring, 2, 1, W, "auto")[0]?.chain[0]).toBe("tile.hull.m10.v1");
    expect(wallPieces(ring, 1, 1, W, "auto")[0]?.chain[0]).toBe("tile.hull.m6");
  });
  it("doors are never cut, orient along their walls and hang the belly in the near hull", () => {
    expect(ids(grid([[F, F, F], [W, D, W], [F, F, F]]), 1, 1, D, "auto")).toEqual(["door.x"]);
    expect(ids(grid([[F, W, F], [F, D, F], [F, W, F]]), 1, 1, D, "down")).toEqual(["door.y"]);
    expect(ids(grid([[F, F, F], [W, D, W]]), 1, 1, D, "up")).toEqual(["door.x", "hull.drop.s"]);
  });
  it("a near-hull ghost replaces the floor under it", () => {
    expect(replacesFloor(ring, 2, 3)).toBe(true);
    expect(replacesFloor(ring, 2, 1)).toBe(false);
    expect(replacesFloor(ring, 2, 1, "down")).toBe(true);
    expect(outward(ring, 1, 3)).toBe(1);
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
