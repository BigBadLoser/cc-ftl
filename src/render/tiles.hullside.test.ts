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
    expect(first(k, 2, 1)).toBe("tile.wall.full.m8");                  // (with the hull's cap on it)
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
  it("a concave step in the far hull is cut where it stands in front of the room on screen (#521)", () => {
    // The west hull steps east at row 3: (4, 3) joins the step wall (W) and the lower west hull (S); the room lies
    // straight behind it on screen. The top edge stays full.
    const k = ship(["      ", " #####", " #___#", " ####_#", "    #_#", "    ###"].map((r) => r.padEnd(7)));
    expect(hullSide(k, 4, 3)).toBe(HullSide.Near);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
  });
  it("a run with floor in front is not near hull, even with space at its +x+y diagonal", () => {
    // (2, 2): a partition along x, rooms at -y and +y, space only at the SE diagonal (a diagonal breach or notch).
    const k = ship(["#####", "#___#", "#####", "##_ #", "#####"]);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(replacesFloor(k, 2, 2)).toBe(false);
    expect(first(k, 2, 2)).toBe("tile.wall.m10");
  });
  it("a step one tile deep in the near hull makes its corner near hull, not a full-height pillar (#494)", () => {
    // The east hull steps out one tile at row 3: (4, 3) is boxed in by near hull at N, E and S, space only at its NE.
    const e = ship(["      ", " #### ", " #__# ", " #__##", " #___#", " #####", "      "]);
    expect(hullSide(e, 4, 3)).toBe(HullSide.Near);
    expect(hullSide(e, 4, 2)).toBe(HullSide.Near);
    expect(hullSide(e, 5, 3)).toBe(HullSide.Near);
    // Without the new hull's art it draws the hull ghost (no full-height block) and, like every near ghost, no floor plate.
    for (const mode of ["up", "auto", "down"] as const) expect(first(e, 4, 3, mode)).toMatch(/^tile\.hull\.ghost\.m\d+$/);
    expect(replacesFloor(e, 4, 3)).toBe(true);
    // The same step on the south hull (transposed): space only at the corner's SW.
    const t = (x: number, y: number) => e(y, x);
    expect(hullSide(t, 3, 4)).toBe(HullSide.Near);
    expect(hullSide(t, 3, 5)).toBe(HullSide.Near);
  });
  it("a wall with the ship behind it on screen is cut, floor in front or not (#521)", () => {
    // (3, 3): floor right in front (+y) and two tiles east, space at its NE and SE diagonals; floor straight behind it.
    const k = ship(["       ", " ######", " #_# _#", " #_##_#", " #__ _#", " ######", "       "]);
    expect(hullSide(k, 3, 3)).toBe(HullSide.Near);
  });
  it("a step in the top edge is cut where it stands in front of the ship's higher part; the top edge stays (#521)", () => {
    const k = ship(["         ", " ####    ", " #__#    ", " #__#### ", " #_____# ", " #_____# ", " #_____# ", " ####### "]);
    for (const x of [4, 5, 6, 7]) expect(hullSide(k, x, 3)).toBe(HullSide.Near);
    expect(hullSide(k, 7, 4)).toBe(HullSide.Near);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
    expect(hullSide(k, 1, 5)).toBe(HullSide.Far);
  });
  it("what is left of the top edge in bits under three tiles is cut: no lone pillars (#521)", () => {
    // The lower part's north wall: (4, 5) and (5, 5) have the tower behind them on screen; (6, 5) and (7, 5) have
    // nothing behind them, but two tiles alone would stand as a pillar.
    const k = ship(["          ", "          ", "          ", " ###      ", " #_#      ", " #_###### ", " #______# ", " ######## "]);
    for (const x of [4, 5, 6, 7]) expect(hullSide(k, x, 5)).toBe(HullSide.Near);
    expect(hullSide(k, 2, 3)).toBe(HullSide.Far);
    expect(hullSide(k, 1, 6)).toBe(HullSide.Far);
  });
  it("a notch's inner corner between cut hull is cut with it, not left as a partition stub (#521)", () => {
    // The notch x 4..5 below the upper part: (6, 4) joins the upper part's front wall (W, near) and the right arm's
    // west wall (S, cut: the upper part is behind it on screen), with a room at its N and E.
    const k = ship(["          ", " ######## ", " #______# ", " #______# ", " #_####_# ", " #_#  #_# ", " #_#  #_# ", " ###  ### "]);
    expect(hullSide(k, 6, 5)).toBe(HullSide.Near);
    expect(hullSide(k, 6, 4)).toBe(HullSide.Near);
  });
  it("thick hull keeps its outer ring as hull and its inside as wall", () => {
    const k = ship(["      ", " #### ", " #### ", " #__# ", " #### ", "      "]);
    expect(hullSide(k, 2, 1)).toBe(HullSide.Far);
    expect(hullSide(k, 2, 2)).toBe(HullSide.None);
    expect(hullSide(k, 2, 4)).toBe(HullSide.Near);
  });
});

describe("a finished rock wall is never hull", () => {
  // R = rock wall, space around it (rock mass reads as Space to the wall art): a Wall there is hull, a RockWall a partition.
  const KR: Record<string, number> = { ...K, R: Struct.RockWall };
  const rock = (rows: string[]) => (x: number, y: number) => KR[rows[y]?.[x] ?? " "] ?? Struct.Space;
  it("draws interior wall pieces in every view, never hull or ghost pieces", () => {
    const rows = ["      ", " RRRR ", " R__R ", " RRRR ", "      "];
    const k = rock(rows);
    for (const [x, y] of [[2, 1], [1, 2], [4, 2], [2, 3], [1, 1], [4, 3]] as const) {
      expect(hullSide(k, x, y)).toBe(HullSide.None);
      expect(replacesFloor(k, x, y, "auto")).toBe(false);
      expect(replacesFloor(k, x, y, "down")).toBe(false);
      for (const mode of ["up", "auto", "down"] as const)
        for (const pc of wallPieces(k, x, y, Struct.Wall, mode)) expect(pc.chain.every((id) => id.startsWith("tile.wall."))).toBe(true);
    }
  });
  it("a metal wall beside rock walls keeps its hull", () => {
    const k = rock(["     ", " #RR ", " #__ ", "     "]);
    expect(hullSide(k, 1, 1)).not.toBe(HullSide.None);
  });
});
