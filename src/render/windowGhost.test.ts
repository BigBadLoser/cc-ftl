import { Container, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import type { Atlas } from "./assets/loader";
import { createWindowGhost } from "./windowGhost";

const atlas = { firstOf: (ids: readonly string[]) => (ids.length ? { tex: new Texture({ label: ids[0] }), glow: null, ax: 0, ay: 0, footprint: [1, 1] } : undefined) } as unknown as Atlas;
const tiles = [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }];

describe("window placement ghost", () => {
  const draw = (valid: boolean, axis: "x" | "y" = "x") => {
    const parent = new Container();
    const ghost = createWindowGhost(parent, atlas);
    ghost.set({ tiles, axis, size: 3, valid });
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
});
