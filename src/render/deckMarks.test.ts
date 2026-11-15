import { describe, expect, it } from "vitest";
import { E, MARK_FILL, N, S, W, type EdgeMarking } from "../sim/marks";
import { markPieces, type MaskAt } from "./deckMarks";

/** A mask reader over a small map of rows of numbers (0 outside). */
const reader = (rows: number[][], x: number, y: number): MaskAt => (dx, dy) => rows[y + dy]?.[x + dx] ?? 0;
const ids = (kind: EdgeMarking, rows: number[][], x: number, y: number) => markPieces(kind, reader(rows, x, y)).sort();

describe("markPieces", () => {
  it("draws nothing for an empty tile and for the door apron", () => {
    expect(ids("walkway", [[0]], 0, 0)).toEqual([]);
    expect(ids("apron", [[N | S]], 0, 0)).toEqual([]);
  });

  it("picks the straight piece of each quarter along an edge", () => {
    // a corridor tile with a wall to its north: a line along the north edge, in both north quarters only
    expect(ids("walkway", [[N, N, N]], 1, 0)).toEqual(["tile.mark.walkway.j.ne", "tile.mark.walkway.j.nw"]);
    // a wall to the west: the line runs along y in the two west quarters
    expect(ids("walkway", [[W], [W], [W]], 0, 1)).toEqual(["tile.mark.walkway.i.nw", "tile.mark.walkway.i.sw"]);
  });

  it("picks the inside corner in the corner quarter, straight pieces in the others", () => {
    expect(ids("walkway", [[N | W, N], [W, 0]], 0, 0)).toEqual([
      "tile.mark.walkway.i.sw", "tile.mark.walkway.ij.nw", "tile.mark.walkway.j.ne",
    ]);
  });

  it("turns the line round a wall's outer corner in the quarter facing it", () => {
    // tile (1,1) has no bits; the tile west of it has a north bit and the one north of it a west bit: a wall at (0,0)
    const rows = [[0, W], [N, 0]];
    expect(ids("walkway", rows, 1, 1)).toEqual(["tile.mark.walkway.n.nw"]);
    // but only that quarter: it needs both neighbours across its own sides
    expect(markPieces("walkway", reader(rows, 1, 1))).toHaveLength(1);
  });

  it("ends a hazard band square where the next tile has none, and runs it on where it continues", () => {
    expect(ids("hazard", [[N, N, 0]], 1, 0)).toEqual(["tile.mark.hazard.j.nw", "tile.mark.hazard.jc.ne"]);
    expect(ids("hazard", [[N, N, N]], 1, 0)).toEqual(["tile.mark.hazard.j.ne", "tile.mark.hazard.j.nw"]);
    // a band along y: its end is at the quarter's y-side edge
    expect(ids("hazard", [[W], [W], [0]], 0, 1)).toEqual(["tile.mark.hazard.i.nw", "tile.mark.hazard.ic.sw"]);
  });

  it("does not end the band where it turns round a wall corner (the diagonal tile carries the turn)", () => {
    // a wall tile at (1,0): (0,1) has a north bit, (1,1) a north-west turn, the band goes on round the corner
    const rows = [[0, W], [N, 0]];
    expect(ids("hazard", rows, 0, 1)).toEqual(["tile.mark.hazard.j.ne", "tile.mark.hazard.jc.nw"]); // (its west end is a real end)
    expect(ids("hazard", rows, 1, 1)).toEqual(["tile.mark.hazard.n.nw"]);
  });

  it("hatches every quarter of a keep-clear tile inside a box, its edges outlined", () => {
    const f = MARK_FILL;
    expect(ids("keepClear", [[f]], 0, 0)).toEqual(["tile.mark.keep.f.ne", "tile.mark.keep.f.nw", "tile.mark.keep.f.se", "tile.mark.keep.f.sw"]);
    expect(ids("keepClear", [[f | N | W]], 0, 0)).toEqual([
      "tile.mark.keep.i.f.sw", "tile.mark.keep.ij.f.nw", "tile.mark.keep.j.f.ne", "tile.mark.keep.f.se",
    ].sort());
  });

  it("outlines a keep-clear box without hatching when the fill flag is absent", () => {
    expect(ids("keepClear", [[E | S]], 0, 0)).toEqual(["tile.mark.keep.i.ne", "tile.mark.keep.ij.se", "tile.mark.keep.j.sw"]);
  });

  it("turns a keep-clear outline round a box's reflex corner only inside the box", () => {
    const f = MARK_FILL;
    const rows = [[0, W | f], [N | f, f]];
    expect(ids("keepClear", rows, 1, 1)).toContain("tile.mark.keep.n.f.nw");
    expect(ids("keepClear", [[0, W], [N, 0]], 1, 1)).toEqual([]);
  });

  it("outlines every edge of a keep-clear box and hatches all its tiles", () => {
    const f = MARK_FILL;
    const rows = [[N | W | f, N | f, N | E | f], [S | W | f, S | f, S | E | f]];
    const all = rows.flatMap((r, y) => r.map((_, x) => ids("keepClear", rows, x, y)));
    expect(all.every((p) => p.length === 4 && p.every((id) => id.includes(".f.")))).toBe(true);
    const edge = (x: number, y: number, quad: string) => all[y * 3 + x]!.find((id) => id.endsWith(quad))!;
    // every quarter on the box's edges carries a line piece (i, j or ij), the inner ones are hatch only
    for (const [x, y, quad] of [[2, 0, "ne"], [2, 0, "se"], [2, 1, "ne"], [2, 1, "se"], [0, 1, "sw"], [0, 1, "se"], [1, 1, "sw"], [1, 1, "se"], [0, 0, "nw"], [0, 0, "sw"], [1, 0, "nw"], [1, 0, "ne"]] as const)
      expect(edge(x, y, quad)).toMatch(/keep\.(i|j|ij)\.f\./);
    expect(edge(1, 0, "se")).toBe("tile.mark.keep.f.se");
  });

  it("joins a staircase corridor: a turn round every wall step, and a line along each side", () => {
    // the 'stairs' test shape: '#' wall, '.' floor; masks are the outline of the floor toward walls
    const map = ["########", "#..#####", "#...####", "##...###", "###...##", "####...#", "#####..#", "########"];
    const bit = (x: number, y: number) => (map[y]?.[x] ?? "#") === "#";
    const rows = map.map((r, y) => [...r].map((c, x) => (c !== "." ? 0 : (bit(x, y - 1) ? N : 0) | (bit(x + 1, y) ? E : 0) | (bit(x, y + 1) ? S : 0) | (bit(x - 1, y) ? W : 0))));
    // (2,2) has floor all round but the wall steps at (3,1) and (1,3): its north-east and south-west quarters turn round them
    expect(rows[2]![2]).toBe(0);
    expect(ids("walkway", rows, 2, 2)).toEqual(["tile.mark.walkway.n.ne", "tile.mark.walkway.n.sw"]);
    // the tile west of the step has the east bit, the one below it the north bit: straight lines that meet that turn
    expect(ids("walkway", rows, 2, 1)).toContain("tile.mark.walkway.ij.ne");
    expect(ids("walkway", rows, 3, 2)).toContain("tile.mark.walkway.j.nw");
    // hazard: same turn, and no end cap on the band where it turns
    expect(ids("hazard", rows, 2, 2)).toEqual(["tile.mark.hazard.n.ne", "tile.mark.hazard.n.sw"]);
    expect(ids("hazard", rows, 2, 1).some((id) => id.includes(".ic."))).toBe(false);
    expect(ids("hazard", rows, 3, 2).some((id) => id.includes(".jc."))).toBe(false);
  });
});
