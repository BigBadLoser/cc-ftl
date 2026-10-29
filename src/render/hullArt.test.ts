import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { bellyIds, exteriorIds, hullKeys, hullPaintParam, tileLook } from "./hullArt";

/** A box ship: hull walls round floors, in a region with a tile of space round it. */
function box(w: number, h: number, extra: (x: number, y: number) => number | undefined = () => undefined) {
  const W = w + 2;
  const H = h + 2;
  const kindAt = (x: number, y: number) => {
    const e = extra(x, y);
    if (e !== undefined) return e;
    if (x < 1 || y < 1 || x > w || y > h) return Struct.Space;
    return x === 1 || y === 1 || x === w || y === h ? Struct.Wall : Struct.Floor;
  };
  return { keys: hullKeys(kindAt, W, H)!, W, H };
}

describe("hullArt", () => {
  it("keys the hull ring and leaves the rooms plain", () => {
    const { keys } = box(8, 6);
    expect(keys.at(4, 6)).toBe("0,1,15"); // near run along x (space at +y)
    expect(keys.at(8, 3)).toBe("1,0,15"); // near run along y (space at +x)
    expect(keys.at(4, 3)).toBe("");
  });

  it("has no keys for a base in rock", () => {
    expect(hullKeys((x, y) => (x === 0 && y === 0 ? Struct.Rock : Struct.Floor), 4, 4)).toBeNull();
  });

  it("picks the run set's piece, a straight run in a design, else the generic piece and its roof", () => {
    const { keys } = box(8, 6);
    const all = () => true;
    expect(exteriorIds(keys, 4, 6, all)![0]).toMatch(/^tile\.hull\.ext\.o1\.m10(\.a[123])?$/);
    expect(exteriorIds(keys, 8, 6, all)).toEqual(["tile.hull.ext.o3.m9"]);
    expect(exteriorIds(keys, 4, 6, (id) => id === "tile.hull.ext.o1.m10")).toEqual(["tile.hull.ext.o1.m10"]);
    const generic = (id: string) => id.startsWith("tile.hull.ext.g.") || id.startsWith("tile.roof.g.");
    expect(exteriorIds(keys, 4, 1, generic)).toEqual(["tile.hull.ext.g.0_m1_15", "tile.roof.g.0_m1_15"]);
    expect(exteriorIds(keys, 4, 1, () => false)).toBeNull();
    expect(exteriorIds(keys, 4, 3, all)).toBeNull();
  });

  it("takes the tile's belly look where the art has it", () => {
    const { keys } = box(8, 6);
    const look = tileLook(4, 6);
    const b = bellyIds(keys, 4, 6, () => true)!;
    expect(b.under).toBe(look === 20 ? "tile.hull.belly.under.0_1_15" : `tile.hull.belly.under.0_1_15.l${look}`);
    expect(bellyIds(keys, 4, 6, (id) => !/\.l\d+$/.test(id))).toEqual({ under: "tile.hull.belly.under.0_1_15", low: "tile.hull.belly.low.0_1_15" });
    expect(bellyIds(keys, 4, 6, () => false)).toBeNull();
  });

  it("reads the debug paint", () => {
    expect(hullPaintParam("?hullPaint=377d87,6ed7cd")).toEqual({ armour: 0x377d87, deco: 0x6ed7cd });
    expect(hullPaintParam("?hullPaint=red")).toBeNull();
  });
});
