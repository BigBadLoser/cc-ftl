import { Container, Sprite, Texture } from "pixi.js";
import { describe, expect, it } from "vitest";
import { JobC } from "../sim/crew/components";
import { World } from "../sim/ecs";
import { Grid } from "../sim/grid";
import { Struct } from "../sim/structure";
import type { Atlas } from "./assets/loader";
import { createJobView } from "./jobView";
import type { Layers } from "./layers";

/** An atlas that has every sprite; a texture's label is its id. */
const atlas = {
  stat: (id: string) => ({ tex: new Texture({ label: id }), glow: null, ax: 0, ay: 0, footprint: [1, 1] }),
  firstOf: (ids: readonly string[]) => ({ tex: new Texture({ label: ids[0] }), glow: null, ax: 0, ay: 0, footprint: [1, 1] }),
} as unknown as Atlas;

function ghostsFor(build: [number, number, number][]): string[] {
  const grid = new Grid(1, 10, 10, { struct: "u8" });
  // A ship: floor 2..7 x 2..5 inside a wall rim.
  for (let y = 1; y <= 6; y++)
    for (let x = 1; x <= 8; x++) grid.set("struct", x, y, x === 1 || x === 8 || y === 1 || y === 6 ? Struct.Wall : Struct.Floor);
  const world = new World();
  for (const [x, y, struct] of build) {
    const id = world.createEntity();
    world.add(id, JobC, { category: "construction", kind: "build", x, y, struct, work: 10, progress: 0, reservedBy: 0 });
  }
  const sorted = new Container();
  const view = createJobView(world, atlas, { sorted } as unknown as Layers, { target: () => ({ grid }) });
  view.update();
  return sorted.children.filter((c): c is Sprite => c instanceof Sprite && c.visible).map((s) => s.texture.label ?? "");
}

describe("blueprint ghosts of new hull", () => {
  it("a pending hull extension draws the new hull art, not the old wall", () => {
    // Grow the ship one row down: a floor row at y 6 under the old rim, and the new rim wall at y 7.
    const ids = ghostsFor([[3, 7, Struct.Wall], [4, 7, Struct.Wall], [5, 7, Struct.Wall]]);
    expect(ids.some((id) => id.startsWith("tile.hull.belly."))).toBe(true);
  });
  it("a pending interior wall keeps the wall art", () => {
    const ids = ghostsFor([[4, 3, Struct.Wall]]);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.some((id) => id.startsWith("tile.hull."))).toBe(false);
  });
});
