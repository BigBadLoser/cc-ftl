/**
 * Asset contract between the Blender sprite pipeline (tools/blender/sprites) and the renderer.
 * The pipeline writes public/assets/<scale>x/manifest.json in this shape (1x: 64x32 tiles, 2x: 128x64); the renderer only
 * reads it, through `compose.ts`, which turns every set into world pixels (128x64 tiles) before anything else sees it.
 */

export const MANIFEST_VERSION = 1;

/** A rectangle in a sprite sheet, in pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Point inside a frame that sits on the asset's world position (feet / front footprint point). */
export interface Anchor {
  x: number;
  y: number;
}

/** A sprite sheet image plus its optional emission (glow) twin with an identical layout. */
export interface SheetDef {
  /** Path relative to public/assets/<scale>x/ in the file; `compose.ts` makes it relative to public/assets/. */
  image: string;
  /** Glow sheet (additive), same size and layout as `image`. */
  glow?: string;
  /** Composed manifests only: texture resolution of the sheet (0.5 for a 1x sheet, drawn at 2x; absent = 1). */
  resolution?: number;
}

/** Static environment piece: floor, wall, hull, door, prop, module. */
export interface StaticAsset {
  kind: 'static';
  sheet: string;
  frame: Rect;
  anchor: Anchor;
  /** Footprint in tiles [x, y]; 1x1 for most tiles. Anchor = front-most footprint tile. */
  footprint: [number, number];
  /** True if the glow sheet has non-empty pixels for this frame. */
  glow?: boolean;
  /** A tool's tip in sprite px from the anchor (the mining pod's laser barrel in its `mine` frames; pod_muzzle.py). */
  muzzle?: [number, number];
}

/** One animation clip of a layer. */
export interface ClipDef {
  /**
   * Sheet holding this clip (8 direction rows x `frames` columns), a key of `Manifest.sheets`. Crew layers have one
   * sheet per clip, so adding a clip or an item never touches the others. Absent: the layer's single `sheet`.
   */
  sheet?: string;
  /** Column of the first frame in that sheet (0 for per-clip sheets). */
  start: number;
  frames: number;
  fps: number;
  loop: boolean;
  /**
   * Trimmed sheets: size of one cell, and where the cell's top-left sits in the layer's frame (so the sprite is drawn at
   * `ox - anchor.x, oy - anchor.y`). The pipeline crops each clip sheet to the union of its opaque pixels. Absent: the
   * cell is the layer's whole frame (`frameW` x `frameH`, offset 0).
   */
  cw?: number;
  ch?: number;
  ox?: number;
  oy?: number;
  /**
   * Held weapons only: `muzzle[direction][frame] = [x, y]`, the barrel end (the tip, for melee) in sprite px from the
   * layer's anchor (x right, y down). Anchor-relative like the cell's `ox`/`oy`, so trimming does not change it.
   */
  muzzle?: [number, number][][];
}

/**
 * One crew sprite layer (body, hair, arm.L, shirt, gear...). All layers of a species share
 * frameW/frameH/anchor so they stack exactly; each lists the clips it has (not every layer has every clip).
 * Sheet layout: row = direction (0..7), column = clip.start + frame. Direction d matches sim Position.facing d
 * (0 = grid +x, counter-clockwise in grid space, 2 = grid +y).
 */
export interface LayerAsset {
  kind: 'crew.layer';
  species: string;
  /** Slot name, e.g. 'body', 'hair', 'eyes', 'arm.L', 'arm.R', 'implant.temple', 'torso', 'legs', 'gear.back'. */
  slot: string;
  /** Stack order (low drawn first). Holdout rendering makes one fixed order valid in all directions. */
  order: number;
  /** Single sheet holding every clip (robots); crew layers name a sheet per clip instead (`ClipDef.sheet`). */
  sheet?: string;
  frameW: number;
  frameH: number;
  anchor: Anchor;
  clips: Record<string, ClipDef>;
  glow?: boolean;
  /** Composed manifests only: world px per art px of this layer's set (2 for a 1x layer, else 1). */
  px?: number;
}

export type AssetDef = StaticAsset | LayerAsset;

export interface Manifest {
  version: number;
  /** Tile size in pixels: 64x32 in the 1x file, 128x64 in the 2x file and in any composed manifest. */
  tile: { w: number; h: number };
  /** Palette-swap key colours ('#rrggbb') rendered for team.* materials, e.g. { 'team.skin': '#ff00ff' }. */
  keyColors: Record<string, string>;
  /** Wall and roof heights in tiles, and px per tile of height (pipeline writes them; heights.test.ts checks them). */
  heights?: { wall: number; roof: number; zPx: number };
  sheets: Record<string, SheetDef>;
  /** Asset id (e.g. 'tile.floor.a', 'crew.human.hair.mohawk') -> definition. */
  assets: Record<string, AssetDef>;
}

/** The cell of a clip's sheet: size, and offset of its top-left inside the layer's frame (see `ClipDef.cw`). */
export function cellOf(a: Pick<LayerAsset, 'frameW' | 'frameH'>, c: ClipDef): { w: number; h: number; ox: number; oy: number } {
  return { w: c.cw ?? a.frameW, h: c.ch ?? a.frameH, ox: c.ox ?? 0, oy: c.oy ?? 0 };
}
