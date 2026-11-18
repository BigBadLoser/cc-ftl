import { describe, expect, it } from "vitest";
import { Struct } from "../sim/structure";
import { standsOnGround } from "../sim/outposts/state";
import type { Ship } from "../sim/combat/components";
import { bellyIds, exteriorIds, hullKeys, isStationPiece } from "./hullArt";
import { BERM_OTHER, BERM_RUN, bermId, lowId } from "./stationHull";
import { wallPieces } from "./tiles";

/** A box base: hull walls round floors, in a region with a tile of space round it. */
function box(w: number, h: number) {
  const kindAt = (x: number, y: number) => {
    if (x < 1 || y < 1 || x > w || y > h) return Struct.Space;
    return x === 1 || y === 1 || x === w || y === h ? Struct.Wall : Struct.Floor;
  };
  return hullKeys(kindAt, w + 2, h + 2)!;
}

const all = () => true;
const berm = (id: string | null) => /^tile\.hull\.station\.berm\.(.+)\.v(\d)(?:\.e(\d)(\d))?$/.exec(id ?? "");

describe("station hull", () => {
  it("stands on the ground only as a surface outpost", () => {
    const ship = (outpost?: Ship["outpost"]) => ({ outpost }) as Ship;
    expect(standsOnGround(ship({ style: "surface", kind: "trading", hidden: false }))).toBe(true);
    expect(standsOnGround(ship({ style: "dug", kind: "pirate", hidden: true }))).toBe(false);
    expect(standsOnGround(ship())).toBe(false);
    expect(standsOnGround(undefined)).toBe(false);
  });

  it("takes the station's pieces where it has them, else the ship's, and no belly", () => {
    const h = box(8, 6);
    expect(exteriorIds(h, 8, 6, all, false, null, "station")).toEqual(["tile.hull.station.ext.o3.m9"]);
    expect(exteriorIds(h, 4, 6, all, false, null, "station")![0]).toMatch(/^tile\.hull\.station\.ext\.o1\.m10(\.a[1-6])?$/);
    const stationGeneric = (id: string) => id.startsWith("tile.hull.station.ext.g.") || id.startsWith("tile.roof.station.g.");
    expect(exteriorIds(h, 4, 1, stationGeneric, false, null, "station")).toEqual(["tile.hull.station.ext.g.0_m1_15", "tile.roof.station.g.0_m1_15"]);
    expect(exteriorIds(h, 8, 6, (id) => !id.includes(".station."), false, null, "station")).toEqual(["tile.hull.ext.o3.m9"]);
    expect(bellyIds(h, 4, 6, all, true, "station")).toBeNull();
    expect(bellyIds(h, 4, 6, all, true, "ship")).not.toBeNull();
  });

  it("uses every station design along a straight run, the ship's only its own", () => {
    const h = box(60, 6);
    const designs = (look: "ship" | "station") =>
      new Set(Array.from({ length: 58 }, (_, i) => exteriorIds(h, i + 2, 6, all, false, null, look)![0]!.replace(/^.*\.m10/, "")));
    expect(designs("station")).toEqual(new Set(["", ".a1", ".a2", ".a3", ".a4", ".a5", ".a6"]));
    expect(designs("ship")).toEqual(new Set(["", ".a1", ".a2", ".a3"]));
  });

  it("paints only the ship look's pieces", () => {
    expect(isStationPiece("tile.hull.station.ext.o1.m10.a2")).toBe(true);
    expect(isStationPiece("tile.roof.station.g.1_1_m1")).toBe(true);
    expect(isStationPiece("tile.hull.station.berm.0_1_15.v4.e01")).toBe(true);
    expect(isStationPiece("tile.hull.ext.o1.m10")).toBe(false);
  });

  it("varies a straight run's berm: a rock clump in every three tiles, no two neighbours alike, ends agreed across each boundary", () => {
    const h = box(40, 6);
    const run = Array.from({ length: 36 }, (_, i) => berm(bermId(h, i + 3, 6, all))!);
    for (const m of run) expect(m[1]).toBe("0_1_15");
    const v = run.map((m) => Number(m[2]));
    for (const n of v) expect(n).toBeLessThan(BERM_RUN);
    for (let i = 1; i < v.length; i++) expect(v[i]).not.toBe(v[i - 1]);
    for (let c = 0; c + 3 <= v.length; c += 3) expect(v.slice(c, c + 3).filter((n) => n < 4).length).toBe(1); // (x 3c + 3 ..: whole cells)
    for (let i = 1; i < run.length; i++) expect(run[i]![3]).toBe(run[i - 1]![4]);
  });

  it("gives any other key one of its own few variants, and no berm without art", () => {
    const h = box(8, 6);
    const m = berm(bermId(h, 8, 6, all))!;
    expect(m[1]).not.toMatch(/^(0_m?1|m?1_0)_[0-9]+$/);
    expect(Number(m[2])).toBeLessThan(BERM_OTHER);
    expect(bermId(h, 4, 3, all)).toBeNull(); // (no key: a room)
    expect(bermId(h, 4, 6, () => false)).toBeNull();
    expect(BERM_OTHER).toBeLessThan(BERM_RUN);
  });

  it("with the walls up takes the station's cap on the far hull, else the ship's, and its foot on the near hull", () => {
    const kindAt = (x: number, y: number) =>
      x < 1 || y < 1 || x > 8 || y > 6 ? Struct.Space : x === 1 || y === 1 || x === 8 || y === 6 ? Struct.Wall : Struct.Floor;
    const cap = (look: "ship" | "station") => wallPieces(kindAt, 4, 1, Struct.Wall, "up", true, undefined, null, look)[1]!.chain;
    expect(cap("station")[0]).toBe("tile.hull.station.cap.m10");
    expect(cap("station")).toContain("tile.hull.cap.m10");
    expect(cap("ship").some((id) => id.includes(".station."))).toBe(false);
    const h = box(8, 6);
    expect(lowId(h, 4, 6, all)).toBe("tile.hull.station.low.0_1_15");
    expect(lowId(h, 4, 6, () => false)).toBeNull();
    expect(lowId(h, 4, 3, all)).toBeNull();
    expect(bermId(h, 4, 6, all, false)).toMatch(/^tile\.hull\.station\.berm\.0_1_15\.v\d\.e\d\d\.low$/);
    expect(bermId(h, 4, 6, all, false)!.replace(/\.low$/, "")).toBe(bermId(h, 4, 6, all));
  });
});
