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
});
