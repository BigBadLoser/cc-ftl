import { Rectangle, Texture } from "pixi.js";
import type { StaticSprite } from "./assets/loader";
import { hullKeyName } from "./hullKey";
import type { HullKeys, HullLook } from "./hullArt";
import type { Piece } from "./tiles";

/**
 * The far hull's diagonal walls with the walls up (#561; tools/blender/sprites/wall_diag.py): a staircase on the far side
 * (its hull front (-1, -1)) draws a wall on the diagonal, one piece per step tile, with its cap.
 */

/** A step tile's piece: "a" the end meeting the run along y, "b" the end meeting the run along x, "m" a step between. */
export type DiagRole = "a" | "m" | "b";

const names = (h: HullKeys, x: number, y: number): string[] => {
  const k = h.at(x, y);
  return k ? hullKeyName(k).split("~") : [];
};

/** The tile's role on a far diagonal (its hull key the diagonal's front through the tile), or null. */
export function diagRole(h: HullKeys, x: number, y: number): DiagRole | null {
  if (!names(h, x, y).includes("m1_m1_m1")) return null;
  if (names(h, x, y + 1).some((n) => n.startsWith("m1_0_"))) return "a";
  if (names(h, x + 1, y).some((n) => n.startsWith("0_m1_"))) return "b";
  return "m";
}

/** The tile's diagonal wall and cap (the station's, falling back to the ship's), or null. A ground base's only for now:
 * a ship keeps its cut hull pieces there. An inner tile of the staircase (its front through the tile's corner, a step at
 * -x) draws nothing: its step draws the panel on it. */
export function diagWallPieces(h: HullKeys, x: number, y: number, look: HullLook): Piece[] | null {
  if (look !== "station") return null;
  if (names(h, x, y).includes("m1_m1_31") && diagRole(h, x - 1, y)) return [];
  const r = diagRole(h, x, y);
  if (!r) return null;
  return [{ chain: [`tile.wall.diag.${r}`], order: 0 }, { chain: [`tile.hull.station.cap.diag.${r}`, `tile.hull.cap.diag.${r}`], order: 1 }];
}

/** The half of a tile's deck a hull diagonal leaves inside: "l" / "r" (a side diagonal, split down the tile's middle) or "t" / "b". */
export type DeckHalf = "l" | "r" | "t" | "b";
const HALVES: Record<string, DeckHalf> = { m1_1_31: "r", "1_m1_31": "l", "1_1_31": "t", m1_m1_31: "b" };

/**
 * The deck half of a diagonal's inner tile (a hull key of one diagonal front through the tile's corner, the steps beside it),
 * where its cut hull drops the floor plate: its cut covers the half toward the front only, the half away from it is deck.
 * Null for any other tile.
 */
export function deckHalf(h: HullKeys, x: number, y: number): DeckHalf | null {
  const n = names(h, x, y);
  return n.length === 1 ? (HALVES[n[0]!] ?? null) : null;
}

const halves = new WeakMap<Texture, Map<DeckHalf, Texture>>();
/** A floor sprite cut to one half of its tile (its anchor at the tile's middle; the cut textures cached per frame). */
export function halfSprite(s: StaticSprite, half: DeckHalf): StaticSprite {
  const t = s.tex, f = t.frame;
  const box: Record<DeckHalf, [number, number, number, number]> = { l: [0, 0, s.ax, f.height], r: [s.ax, 0, f.width, f.height], t: [0, 0, f.width, s.ay], b: [0, s.ay, f.width, f.height] };
  const [x0, y0, x1, y1] = box[half];
  let m = halves.get(t);
  if (!m) halves.set(t, (m = new Map()));
  let tex = m.get(half);
  if (!tex) m.set(half, (tex = new Texture({ source: t.source, frame: new Rectangle(f.x + x0, f.y + y0, x1 - x0, y1 - y0) })));
  return { ...s, tex, glow: null, ax: s.ax - x0, ay: s.ay - y0 };
}
