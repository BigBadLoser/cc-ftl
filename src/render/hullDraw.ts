import { Container, Sprite, type Texture } from "pixi.js";
import type { Atlas, StaticSprite } from "./assets/loader";
import { Struct } from "../sim/structure";
import type { WindowTile } from "../sim/windows";
import { depthKey, iso } from "./iso";
import type { Layers } from "./layers";
import { addStatic } from "./sprites";
import { HullSprite } from "./hullPaint";
import { replacesFloor, hideReach, hullSide, HullSide, wallLevel, type CutawayMode } from "./tiles";
import { bellyIds, exteriorIds, isStationPiece, nearGhostId, PLAIN_PAINT, type HullKeys, type HullLook, type HullPaint } from "./hullArt";
import { bermId, lowId } from "./stationHull";

/** One tile sprite recoloured by the light and its paint (see `GridView.update`). */
export interface Tinted {
  spr: Sprite;
  /** Local tile, and its index inside the chunk's arrays. */
  x: number;
  y: number;
  ci: number;
  wall: boolean;
  /** Walls and doors darken as their integrity drops. */
  solid: boolean;
  /** Paint multiplied over the light: the hull's armour, or its deco on a deco layer, or the carpet's. */
  paint?: number;
}

/** What `drawHull` reads of the grid view; the mutable fields are getters, read at each call. */
export interface HullDrawCtx {
  atlas: Atlas;
  L: Layers;
  width: number;
  has: (id: string) => boolean;
  wallAt: (x: number, y: number) => number;
  pieceAt: (x: number, y: number) => number;
  rearCut: (x: number, y: number) => boolean;
  paint: () => HullPaint | undefined;
  look: () => HullLook | undefined;
  ghosts: () => boolean;
  mode: () => CutawayMode;
  blockHull: () => ReadonlySet<number>;
  lockRow: () => ReadonlySet<number>;
  tubeRow: () => ReadonlySet<number>;
}

/** A sprite recoloured by its tint (hullPaint.ts, carpetPaint.ts: the paint times the light), anchored like `addStatic`. */
export function addPaintSprite<T extends Sprite>(s: StaticSprite, x: number, y: number, key: number, parent: Container, Make: new (t: Texture) => T): T {
  const p = iso(x, y);
  const spr = new Make(s.tex);
  spr.position.set(Math.round(p.x - s.ax), Math.round(p.y - s.ay));
  spr.zIndex = key;
  parent.addChild(spr);
  return spr;
}

/** The tile chunk's sprite lists `drawHull` adds to. */
export interface HullTarget { owned: Sprite[]; tinted: Tinted[] }

export function createHullDrawer(c: HullDrawCtx): (h: HullKeys, x: number, y: number, k: number, ci: number, v: HullTarget, bellyOnly?: boolean, base?: boolean, win?: WindowTile | null, behind?: boolean) => boolean {
  const { atlas, L, width, has, wallAt, pieceAt, rearCut } = c;
  /**
   * The new hull's sprites on tile (x, y), if it has them: roofed, the exterior pieces (hullArt.exteriorIds) and the
   * belly under them; in cutaway the belly of a near hull tile or of a floor its hull reaches (`low` its cut top). Each
   * piece takes the armour paint, its deco layer (`<id>.tint`) the deco paint. `bellyOnly`: just the belly below the deck
   * (an engine's hull row); `base`: a straight run's base design only (an engine's row, an airlock's door). False if it
   * drew nothing.
   */
  function drawHull(h: HullKeys, x: number, y: number, k: number, ci: number, v: HullTarget, bellyOnly = false, base = false, win: WindowTile | null = null, behind = false): boolean {
    const paint = c.paint() ?? PLAIN_PAINT;
    const look = c.look() ?? "ship";
    const put = (id: string, z: number, parent: Container, solid: boolean) => {
      const s = atlas.stat(id);
      if (!s) return;
      for (const [pid, col] of [[id, paint.armour], [`${id}.tint`, paint.deco]] as const) {
        const ps = pid === id ? s : atlas.stat(pid);
        if (!ps) continue;
        // A station piece keeps its own grey (lit only, no armour paint); its `.tint` livery takes the deco paint.
        const bare = pid === id && isStationPiece(id);
        const spr = addPaintSprite(ps, x, y, z + (pid === id ? 0 : 0.0005), parent, bare ? Sprite : HullSprite);
        v.owned.push(spr);
        v.tinted.push({ spr, x, y, ci, wall: true, solid, paint: bare ? undefined : col });
      }
    };
    // A ground base's berm (stationHull.ts) heaps against the hull's foot, over the tile's piece.
    const berm = () => {
      const id = look === "station" ? bermId(h, x, y, has, !c.ghosts()) : null;
      if (id) put(id, z + 0.002, L.sorted, solid);
      return !!id;
    };
    const solid = k !== Struct.Floor;
    const z = depthKey(x, y);
    if (bellyOnly) {
      const b = bellyIds(h, x, y, has, k !== Struct.Floor, look);
      if (b?.under) put(b.under, z, L.under, solid);
      return !!b?.under;
    }
    if (!c.ghosts()) {
      const ext = exteriorIds(h, x, y, has, base, win, look);
      if (!ext) return false;
      // The roof stand-in at the roof plating's depth: over the tile's piece, under the hull of the tiles in front. `behind`: a
      // tube's hull row or far door, sorted (roof and all) under the tube's art, whose first tile shares the row's front tile's depth.
      ext.forEach((id) => put(id, z + (id.startsWith("tile.roof.") ? (behind ? -0.04 : 0.9) : behind ? -0.05 : 0), L.sorted, solid));
      const b = bellyIds(h, x, y, has, false, look);
      if (b?.under) put(b.under, z, L.under, solid);
      berm();
      return true;
    }
    // A wall tile shows its cut hull where its ghost replaces the floor: the near hull, and the far hull with the walls down.
    // (A base asks as its wall pieces do, a tube junction standing in for space; a ship as on main.)
    if (k !== Struct.Floor && !replacesFloor(look === "station" ? pieceAt : wallAt, x, y, c.mode(), hideReach(look))) return false;
    // With the walls down a ground base's hull is cut as a ship's is (the same cut top, seam and ghosts), only no belly
    // under the deck: it stands on the ground.
    const station = look === "station";
    const down = wallLevel(c.mode()) === "low";
    if (station && !down) {
      // A ground base's near hull: the station's foot (no belly), the berm against it.
      const foot = lowId(h, x, y, has);
      if (foot) put(foot, z + 0.001, L.sorted, solid);
      // Its ghost over the cut, as a ship's near hull's (the station's: on its cut). A back-facing cut keeps its rear ramp ghost
      // (wallPieces) instead.
      const g = foot && !rearCut(x, y) ? nearGhostId(h, x, y, has, solid, "station") : undefined;
      const gs = g ? atlas.stat(g) : undefined;
      if (gs) v.owned.push(...addStatic(L, gs, x, y, z + 0.0025, L.sorted));
      return berm() || !!foot;
    }
    const cutLook: HullLook = station ? "ship" : look;
    const heaped = berm();
    const b = bellyIds(h, x, y, has, k !== Struct.Floor, cutLook);
    if (!b) return heaped;
    if (b.under && !station) put(b.under, z, L.under, solid);
    // Behind the thruster block the engine's hull sprite carries the wall's lower section: the belly's cut top would cover it.
    // Beside a camera-facing airlock's door its hull sprite carries the outer half of the cut hull (the inner half is
    // inside its full-height row and would show through the row's end cut).
    if (b.low && !c.blockHull().has(y * width + x) && !c.lockRow().has(y * width + x) && !c.tubeRow().has(y * width + x)) {
      put(b.low, z + 0.001, L.sorted, solid);
      // Its unpainted layer (`.own`, hulltiles._items): the blue seam keeps its blue under the armour paint.
      const own = atlas.stat(`${b.low}.own`);
      if (own) v.owned.push(...addStatic(L, own, x, y, z + 0.0015, L.sorted));
      // The cut hull's ghost over its cut top: an upright on its outer edge (unpainted, unlit). Not the far hull's with the
      // walls down: its old ghost (the outline) stays over it.
      const far = k !== Struct.Floor && hullSide(wallAt, x, y, hideReach(look)) === HullSide.Far;
      const g = far ? undefined : nearGhostId(h, x, y, has, k !== Struct.Floor, cutLook);
      const gs = g ? atlas.stat(g) : undefined;
      if (gs) v.owned.push(...addStatic(L, gs, x, y, z + 0.002, L.sorted));
    }
    return true;
  }
  return drawHull;
}
