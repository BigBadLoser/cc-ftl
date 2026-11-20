import { describe, expect, it } from "vitest";
import { hullKey, hullOutline } from "./hullKey";
import type { HullKeys } from "./hullArt";
import { diagRole, diagWallPieces } from "./diagWall";

/** Hull keys of an 8 x 8 block with its far corner cut `cut` tiles deep (x + y >= cut). */
function cutCorner(cut: number): HullKeys {
  const tiles: [number, number][] = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) if (x + y >= cut) tiles.push([x, y]);
  const loops = hullOutline(tiles);
  const inMask = new Set(tiles.map(([x, y]) => `${x},${y}`));
  return { at: (x, y) => (inMask.has(`${x},${y}`) ? hullKey(loops, x, y) : ""), ship: (x, y) => inMask.has(`${x},${y}`) };
}

describe("diagRole", () => {
  it("names a one-tile cut's two step tiles as its ends", () => {
    const h = cutCorner(1);
    expect([diagRole(h, 0, 1), diagRole(h, 1, 0)]).toEqual(["a", "b"]);
    expect(diagRole(h, 1, 1)).toBeNull(); // (the inner tile: floor, its panel drawn by the step at -x)
  });

  it("names the steps between a longer cut's ends", () => {
    const h = cutCorner(3);
    expect([0, 1, 2, 3].map((x) => diagRole(h, x, 3 - x))).toEqual(["a", "m", "m", "b"]);
    expect(diagRole(h, 4, 0)).toBeNull(); // (the straight run)
  });

  it("draws on a ground base only, the station's cap ahead of the ship's", () => {
    const h = cutCorner(2);
    expect(diagWallPieces(h, 1, 1, "station")).toEqual([
      { chain: ["tile.wall.diag.m"], order: 0 },
      { chain: ["tile.hull.station.cap.diag.m", "tile.hull.cap.diag.m"], order: 1 },
    ]);
    expect(diagWallPieces(h, 1, 1, "ship")).toBeNull();
    expect(diagWallPieces(h, 1, 2, "station")).toEqual([]); // (an inner tile: its panel is its step's)
    expect(diagWallPieces(h, 1, 2, "ship")).toBeNull();
  });
});
