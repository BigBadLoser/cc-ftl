import { describe, expect, it } from "vitest";
import cases from "../../tools/blender/hull_key_cases.json";
import catalog from "../../tools/blender/hull_keys.json";
import { hullKey, hullKeyGeneric, hullKeyName, hullOutline, parseHullKey } from "./hullKey";

type Case = { name: string; cells: [number, number][]; keys: string[] };

describe("hullKey", () => {
  // The fixture is hull_outline.py's output for the preview ships (tools/blender/preview/belly_shapes.py).
  for (const c of cases as Case[])
    it(`matches hull_outline.py on ${c.name}`, () => {
      const loops = hullOutline(c.cells);
      expect(c.cells.map(([x, y]) => hullKey(loops, x, y))).toEqual(c.keys);
    });

  it("does not depend on the order of the tiles", () => {
    const c = (cases as Case[]).find((k) => k.name === "s1040")!;
    const loops = hullOutline([...c.cells].reverse());
    expect(c.cells.map(([x, y]) => hullKey(loops, x, y))).toEqual(c.keys);
  });

  it("round-trips the catalog's keys", () => {
    for (const k of Object.keys(catalog)) {
      const back = parseHullKey(k).map((p) => p.map(([s, c]) => `${s[0]},${s[1]},${c}`).join(";")).join("|");
      expect(back).toBe(k);
    }
  });

  it("names and classes keys as the art does", () => {
    expect(hullKeyName("0,1,15;-1,0,15|1,1,-1")).toBe("0_1_15~m1_0_15+1_1_m1");
    expect(hullKeyGeneric("0,1,15;1,0,15")).toBe(false);
    expect(hullKeyGeneric("1,1,31")).toBe(true);
    expect(hullKeyGeneric("0,-1,15")).toBe(true);
  });
});
