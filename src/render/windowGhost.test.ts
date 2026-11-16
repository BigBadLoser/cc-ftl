import { Container, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import type { Atlas } from "./assets/loader";
import { createWindowGhost } from "./windowGhost";

const atlas = { stat: () => ({}), firstOf: (ids: readonly string[]) => (ids.length ? { tex: new Texture({ label: ids[0] }), glow: null, ax: 0, ay: 0, footprint: [1, 1] } : undefined) } as unknown as Atlas;
let gridOf: (ship: number) => Grid | undefined = () => undefined;
const tiles = [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }];

describe("window placement ghost", () => {
  const draw = (valid: boolean, axis: "x" | "y" = "x") => {
    const parent = new Container();
    const ghost = createWindowGhost(parent, atlas, gridOf);
    ghost.set({ ship: 1, tiles, axis, size: 3, valid });
    return { parent, ghost, sprites: (parent.children[0] as Container).children as Sprite[] };
  };
  it("draws each tile's full-height window piece (l, m, r) in the preview tint, added", () => {
    const { sprites } = draw(true);
    expect(sprites.map((s) => s.texture.label)).toEqual(["tile.wall.full.m10.win.l", "tile.wall.full.m10.win.m", "tile.wall.full.m10.win.r"]);
    expect(sprites.every((s) => s.tint === 0x22d3ee && s.blendMode === "add" && s.visible)).toBe(true);
    expect(draw(true, "y").sprites[0]!.texture.label).toBe("tile.wall.full.m5.win.l");
  });
  it("is red when invalid and hides on null", () => {
    const { ghost, parent, sprites } = draw(false);
    expect(sprites.every((s) => s.tint === 0xff4d4d)).toBe(true);
    ghost.set(null);
    expect((parent.children[0] as Container).visible).toBe(false);
  });
  it("on a straight near hull run takes the hull window's exterior piece, along either axis", () => {
    // A 10 x 8 ship: floor inside a wall rim; its bottom rim (y 7) is near hull along x, its east rim (x 9) along y.
    const grid = new Grid(1, 10, 8, { struct: "u8" });
    for (let y = 0; y < 8; y++) for (let x = 0; x < 10; x++) grid.set("struct", x, y, x === 0 || y === 0 || x === 9 || y === 7 ? Struct.Wall : Struct.Floor);
    gridOf = () => grid;
    const parent = new Container();
    const ghost = createWindowGhost(parent, atlas, gridOf);
    ghost.set({ ship: 1, tiles: [3, 4, 5].map((x) => ({ x, y: 7 })), axis: "x", size: 3, valid: true });
    expect(((parent.children[0] as Container).children as Sprite[]).map((s) => s.texture.label)).toEqual(["tile.hull.ext.o1.m10.w1", "tile.hull.ext.o1.m10.w2", "tile.hull.ext.o1.m10.w3"]);
    ghost.set({ ship: 1, tiles: [2, 3].map((y) => ({ x: 9, y })), axis: "y", size: 2, valid: true });
    expect(((parent.children[0] as Container).children as Sprite[]).slice(0, 2).map((s) => s.texture.label)).toEqual(["tile.hull.ext.o2.m5.w1", "tile.hull.ext.o2.m5.w3"]);
    gridOf = () => undefined;
  });
});
