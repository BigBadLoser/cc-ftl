/**
 * The layout lab's shared camera, as pure maths. One view (a centre in tile coordinates and an iso zoom level) drives both
 * panes: the grid pane is top-down (a tile is a square of `scaleOf` css px) and the preview is the game's isometric camera
 * (the renderer's own zoom ladder, a tile a 2:1 diamond). A tile's coordinates are the iso convention: integers are tile
 * centres, so tile i covers [i - 0.5, i + 0.5].
 *
 * Scales match by area: the grid's tile side is the square root of the diamond's area (TILE_W x TILE_H / 2), which is
 * TILE_H x zoom / dpr css px. Both panes use the renderer's zoom levels, so a zoom step lands on the same scale in each.
 */
import { ART_SCALE, TILE_H, iso, unIso } from '../../src/render/iso';
import { zoomLevels } from '../../src/render/camera';

/** Where the lab's ship sits in the sector (the preview's sim): design tile (0, 0) is sector tile (ORIGIN, ORIGIN). */
export const ORIGIN = 8;
/** The renderer's `focusTile` centres this many art px above a tile's floor diamond; the grid-to-iso mapping includes it. */
export const FOCUS_BIAS = 8 * ART_SCALE;
/** The renderer's largest zoom (its 'high' quality camera). */
const MAX_ZOOM = 3;

export type Space = 'grid' | 'iso';
export interface View {
  /** Centre, in tile coordinates (design tiles, integers are tile centres). */
  cx: number;
  cy: number;
  /** An iso zoom level (device px per world px): one of `ladder(dpr)`. */
  zoom: number;
}
export interface Box { w: number; h: number }
export interface Pt { x: number; y: number }

/** The zoom levels the preview's camera offers at this device pixel ratio (mirrors `Camera.resize`). */
export function ladder(dpr: number): number[] {
  const dprInt = Math.max(1, Math.round(dpr));
  return zoomLevels(Math.max(1, Math.ceil((MAX_ZOOM * dprInt) / ART_SCALE - 1e-9)));
}

/** Css px a grid tile's side spans at an iso zoom level. */
export const scaleOf = (zoom: number, dpr: number): number => (TILE_H * zoom) / dpr;

/** The tile under a pane-relative css px position. */
export function toTile(space: Space, v: View, dpr: number, box: Box, sx: number, sy: number): Pt {
  const dx = sx - box.w / 2, dy = sy - box.h / 2;
  if (space === 'grid') {
    const s = scaleOf(v.zoom, dpr);
    return { x: v.cx + dx / s, y: v.cy + dy / s };
  }
  const c = iso(v.cx + ORIGIN, v.cy + ORIGIN);
  const t = unIso(c.x + (dx * dpr) / v.zoom, c.y - FOCUS_BIAS + (dy * dpr) / v.zoom);
  return { x: t.x - ORIGIN, y: t.y - ORIGIN };
}

/** The pane-relative css px position of a tile (its centre). */
export function toScreen(space: Space, v: View, dpr: number, box: Box, tx: number, ty: number): Pt {
  if (space === 'grid') {
    const s = scaleOf(v.zoom, dpr);
    return { x: (tx - v.cx) * s + box.w / 2, y: (ty - v.cy) * s + box.h / 2 };
  }
  const c = iso(v.cx + ORIGIN, v.cy + ORIGIN);
  const p = iso(tx + ORIGIN, ty + ORIGIN);
  return { x: ((p.x - c.x) * v.zoom) / dpr + box.w / 2, y: ((p.y - (c.y - FOCUS_BIAS)) * v.zoom) / dpr + box.h / 2 };
}

/** The view after dragging a pane by (dx, dy) css px. */
export function panned(space: Space, v: View, dpr: number, dx: number, dy: number): View {
  const box = { w: 0, h: 0 };
  const a = toTile(space, v, dpr, box, 0, 0), b = toTile(space, v, dpr, box, dx, dy);
  return { ...v, cx: v.cx - (b.x - a.x), cy: v.cy - (b.y - a.y) };
}

/** The view one zoom level in (dir > 0) or out, keeping the tile under (sx, sy) where it is. */
export function zoomed(space: Space, v: View, dpr: number, box: Box, sx: number, sy: number, dir: number): View {
  const levels = ladder(dpr);
  let i = levels.findIndex((l) => l >= v.zoom - 1e-9);
  if (i < 0) i = levels.length - 1;
  const j = Math.max(0, Math.min(levels.length - 1, i + (dir > 0 ? 1 : -1)));
  const zoom = levels[j] as number;
  if (zoom === v.zoom) return v;
  const under = toTile(space, v, dpr, box, sx, sy);
  const moved = { ...v, zoom };
  const after = toTile(space, moved, dpr, box, sx, sy);
  return { ...moved, cx: v.cx + (under.x - after.x), cy: v.cy + (under.y - after.y) };
}

/** A view centred on a design of w x h tiles at the largest level that fits it in the grid pane (with a margin). */
export function fitted(w: number, h: number, dpr: number, box: Box): View {
  const levels = ladder(dpr);
  let zoom = levels[0] as number;
  for (const l of levels) if (w * scaleOf(l, dpr) <= box.w * 0.92 && h * scaleOf(l, dpr) <= box.h * 0.92) zoom = l;
  return { cx: (w - 1) / 2, cy: (h - 1) / 2, zoom };
}
