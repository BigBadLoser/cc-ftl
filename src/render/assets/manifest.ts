/**
 * Asset contract between the Blender sprite pipeline (tools/blender/sprites) and the renderer.
 * The pipeline writes public/assets/manifest.json in this shape; the renderer only reads it.
 * Pixel units are art pixels at 1x. Tiles are 64x32 diamonds.
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
  /** Path relative to public/assets/. */
  image: string;
  /** Glow sheet (additive), same size and layout as `image`. */
  glow?: string;
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
}

/** One animation clip inside a layer sheet. */
export interface ClipDef {
  /** Column of the first frame. */
  start: number;
  frames: number;
  fps: number;
  loop: boolean;
}

/**
 * One crew sprite layer (body, hair, arm.L, shirt, gear...). All layers of a species share
 * frameW/frameH/anchor/clips so they stack exactly. Sheet layout: row = direction (0..7),
 * column = clip.start + frame. Direction d matches sim Position.facing d
 * (0 = grid +x, counter-clockwise in grid space, 2 = grid +y).
 */
export interface LayerAsset {
  kind: 'crew.layer';
  species: string;
  /** Slot name, e.g. 'body', 'hair', 'eyes', 'arm.L', 'arm.R', 'implant.temple', 'torso', 'legs', 'gear.back'. */
  slot: string;
  /** Stack order (low drawn first). Holdout rendering makes one fixed order valid in all directions. */
  order: number;
  sheet: string;
  frameW: number;
  frameH: number;
  anchor: Anchor;
  clips: Record<string, ClipDef>;
  glow?: boolean;
}

export type AssetDef = StaticAsset | LayerAsset;

export interface Manifest {
  version: number;
  /** Tile size at 1x in pixels (64x32). */
  tile: { w: number; h: number };
  /** Palette-swap key colours ('#rrggbb') rendered for team.* materials, e.g. { 'team.skin': '#ff00ff' }. */
  keyColors: Record<string, string>;
  sheets: Record<string, SheetDef>;
  /** Asset id (e.g. 'tile.floor.a', 'crew.human.hair.mohawk') -> definition. */
  assets: Record<string, AssetDef>;
}
