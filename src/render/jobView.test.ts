import { Container, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { JobC } from "../sim/crew/components";
import { World } from "../sim/ecs";
import { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import { windowCode } from "../sim/windows";
import type { Atlas } from "./assets/loader";
import { createJobView } from "./jobView";
import type { Layers } from "./layers";

/** An atlas that has every sprite; a texture's label is its id. */
const atlas = {
  stat: (id: string) => ({ tex: new Texture({ label: id }), glow: null, ax: 0, ay: 0, footprint: [1, 1] }),
  firstOf: (ids: readonly string[]) => ({ tex: new Texture({ label: ids[0] }), glow: null, ax: 0, ay: 0, footprint: [1, 1] }),
} as unknown as Atlas;

function ghostsFor(build: [number, number, number][], layer: "sorted" | "under" = "sorted", window: (number | undefined)[] = [], sprites = false): string[] | Sprite[] {
  const grid = new Grid(1, 10, 10, { struct: "u8" });
  // A ship: floor 2..7 x 2..5 inside a wall rim.
  for (let y = 1; y <= 6; y++)
    for (let x = 1; x <= 8; x++) grid.set("struct", x, y, x === 1 || x === 8 || y === 1 || y === 6 ? Struct.Wall : Struct.Floor);
  const world = new World();
  build.forEach(([x, y, struct], i) => {
    const id = world.createEntity();
    world.add(id, JobC, { category: "construction", kind: "build", x, y, struct, work: 10, progress: 0, reservedBy: 0, ...(window[i] === undefined ? {} : { window: window[i] }) });
  });
  const layers = { sorted: new Container(), under: new Container() };
  const view = createJobView(world, atlas, layers as unknown as Layers, { target: () => ({ grid }) });
  view.update();
  const out = layers[layer].children.filter((c): c is Sprite => c instanceof Sprite && c.visible);
  return sprites ? out : out.map((s) => s.texture.label ?? "");
}
const idsFor = (...a: Parameters<typeof ghostsFor>) => ghostsFor(a[0], a[1], a[2], false) as string[];

describe("blueprint ghosts of new hull", () => {
  it("a pending hull extension draws the new hull art, not the old wall", () => {
    // Grow the ship one row down: a floor row at y 6 under the old rim, and the new rim wall at y 7.
    const ids = idsFor([[3, 7, Struct.Wall], [4, 7, Struct.Wall], [5, 7, Struct.Wall]]);
    expect(ids.some((id) => id.startsWith("tile.hull.belly."))).toBe(true);
  });
  it("a pending interior wall keeps the wall art", () => {
    const ids = idsFor([[4, 3, Struct.Wall]]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith("tile.hull."))).toBe(false);
  });
  it("a pending door on the near hull keeps its door sprite beside the hull piece", () => {
    const ids = idsFor([[3, 7, Struct.Wall], [4, 7, Struct.Door], [5, 7, Struct.Wall]]);
    expect(ids.some((id) => id.startsWith("tile.door"))).toBe(true);
  });
  it("the below-deck belly piece goes to the under layer", () => {
    const sorted = idsFor([[3, 7, Struct.Wall], [4, 7, Struct.Wall], [5, 7, Struct.Wall]]);
    const under = idsFor([[3, 7, Struct.Wall], [4, 7, Struct.Wall], [5, 7, Struct.Wall]], "under");
    expect(under.some((id) => id.startsWith("tile.hull.belly.under"))).toBe(true);
    expect(sorted.some((id) => id.startsWith("tile.hull.belly.under"))).toBe(false);
  });
});

describe("queued window ghosts", () => {
  // The top rim (y 1) is a far hull run, the bottom rim (y 6) near hull: a window on 3..5 along x.
  const codes = [0, 1, 2].map((i) => windowCode("x", 3, i));
  const far: [number, number, number][] = [[3, 1, Struct.Wall], [4, 1, Struct.Wall], [5, 1, Struct.Wall]];
  const near: [number, number, number][] = [[3, 6, Struct.Wall], [4, 6, Struct.Wall], [5, 6, Struct.Wall]];
  it("draws in the window tint, added over the wall, where a plain wall ghost is the normal cyan", () => {
    const win = ghostsFor(far, "sorted", codes, true) as Sprite[];
    expect(win.length).toBeGreaterThan(0);
    expect(win.every((s) => s.tint === 0x22d3ee && s.blendMode === "add")).toBe(true);
    const plain = ghostsFor(far, "sorted", [], true) as Sprite[];
    expect(plain.every((s) => s.blendMode === "normal")).toBe(true);
  });
  it("on the near hull draws the rim ghost the built tile shows, not a full-height wall frame", () => {
    const ids = idsFor(near, "sorted", codes);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith("tile.hull.belly.low."))).toBe(true);
    expect(ids.some((id) => id.startsWith("tile.wall.full") || id.includes(".win."))).toBe(false);
    expect(ids).toEqual(idsFor(near));
  });
  it("on the far hull draws the window piece the built tile shows (the hull is always full height)", () => {
    expect(idsFor(far, "sorted", codes).filter((id) => id.includes(".win.")).length).toBe(3);
  });
});
