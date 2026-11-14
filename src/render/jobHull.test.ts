import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { pendingHull, pendingHullKeys } from "./jobHull";

const W = 8;
const H = 8;
/** A 4x4 ship at (2,2), its rim walls, with a pending extra wall row at y = 6. */
const kindAt = (x: number, y: number): number => {
  if (x >= 2 && x < 6 && y >= 2 && y < 7) return x === 2 || x === 5 || y === 2 || y === 6 ? Struct.Wall : Struct.Floor;
  return Struct.Space;
};
const has = () => true;

describe("pending hull ghosts", () => {
  const h = pendingHullKeys(kindAt, W, H);
  it("a pending near-hull wall shows the hull piece, not the old wall", () => {
    const g = pendingHull(h, kindAt, 3, 6, Struct.Wall, has);
    expect(g?.replacesWall).toBe(true);
    expect(g?.under ?? g?.low).toMatch(/^tile\.hull\.belly\./);
  });
  it("a pending interior wall keeps the old art", () => {
    expect(pendingHull(h, kindAt, 3, 3, Struct.Wall, (id) => has() && !!id)).toBeNull();
  });
  it("no hull art, no ghost", () => {
    expect(pendingHull(h, kindAt, 3, 6, Struct.Wall, () => false)).toBeNull();
  });
});
