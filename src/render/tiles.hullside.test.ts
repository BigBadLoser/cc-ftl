import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { HullSide, hullSide, replacesFloor, wallPieces } from "./tiles";

const K: Record<string, number> = { " ": Struct.Space, "#": Struct.Wall, _: Struct.Floor, D: Struct.Door, "=": Struct.Beam };
const ship = (rows: string[]) => (x: number, y: number) => K[rows[y]?.[x] ?? " "] ?? Struct.Space;
const first = (k: (x: number, y: number) => number, x: number, y: number, mode: "auto" | "up" | "down" = "auto") =>
  wallPieces(k, x, y, Struct.Wall, mode)[0]?.chain.at(-1);

describe("hull side (far hull stays full in cutaway, near hull is a ghost)", () => {
  it("a plain ring: north / west far, south / east near", () => {
    const k = ship(["     ", " ### ", " #_# ", " ### ", "     "]);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
    expect(hullSide(k, 1, 2)).toBe(HullSide.Far);
    expect(hullSide(k, 2, 3)).toBe(HullSide.Near);
    expect(hullSide(k, 3, 2)).toBe(HullSide.Near);
  });
  it("a wall with a room behind it that touches space only diagonally is a partition, not far hull", () => {
    // (2, 2): the room's south wall (floor behind it at -y), space only at its SW diagonal past a beam.
    const k = ship(["#####", "#___#", "#####", "# ==#"]);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(first(k, 2, 2)).toBe("tile.wall.m10");                       // cut, not tile.hull.m10 (full height)
  });
  it("the inner corner of a thick near hull (rooms at -x and -y) is cut, not a full far hull", () => {
    const k = ship(["    ", " __ ", " _##", "  ##"]);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(first(k, 2, 2)).toBe("tile.wall.m6");
  });
  it("a far hull run ending at a step in the outline stays far (it was a ghost)", () => {
    // (2, 1): the north hull's last tile, space at +x and -y, its room below: the north wall of that room.
    const k = ship(["     ", "###  ", "#__# ", "#__# ", "#### "]);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
    expect(first(k, 2, 1)).toBe("tile.hull.m8");
    expect(replacesFloor(k, 2, 1)).toBe(false);
  });
  it("a partition that ends at a breach in the near hull is a cut partition, not a ghost", () => {
    const k = ship(["#####", "#_#_#", "#_#_#", "## ##"]);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(first(k, 2, 2)).toBe("tile.wall.m1");
    expect(replacesFloor(k, 2, 2)).toBe(false);
  });
  it("a partition that touches space through a breach in the far hull stays a partition", () => {
    const k = ship(["## ##", "#_#_#", "#_#_#", "#####"]);
    expect(hullSide(k, 2, 1)).toBe(HullSide.None);
    expect(first(k, 2, 1, "down")).toBe("tile.wall.low.m4");
  });
  it("a concave step in the far hull keeps its corner far (space only diagonally behind)", () => {
    // The west hull steps east at row 3: (3, 3) joins the step wall (W) and the lower west hull (S).
    const k = ship(["      ", " #####", " #___#", " ####_#", "    #_#", "    ###"].map((r) => r.padEnd(7)));
    expect(hullSide(k, 4, 3)).toBe(HullSide.Far);
  });
  it("thick hull keeps its outer ring as hull and its inside as wall", () => {
    const k = ship(["      ", " #### ", " #### ", " #__# ", " #### ", "      "]);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(hullSide(k, 2, 4)).toBe(HullSide.Near);
  });
});
