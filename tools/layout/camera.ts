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

/** The ladder step nearest a zoom (in the log scale the ladder is built in). */
export function nearestLevel(zoom: number, dpr: number): number {
  let best = 0, gap = Infinity;
  for (const l of ladder(dpr)) { const g = Math.abs(Math.log(l / zoom)); if (g < gap) { gap = g; best = l; } }
  return best;
}
/** The view the preview shows for a shared view: the same centre at the nearest ladder step (the grid may sit between steps after a fit). */
export const previewView = (v: View, dpr: number): View => ({ ...v, zoom: nearestLevel(v.zoom, dpr) });

/** The grid's tile sides in css px, one step each (whole pixels, so the grid lines stay crisp); 16 px is 100%. */
export const GRID_SIDES: readonly number[] = [3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
export const SIDE_100 = 16;
/** The grid's zoom steps as shared-view zooms (iso-equivalent: tile side x dpr / TILE_H), smallest first. */
export const gridLadder = (dpr: number): number[] => GRID_SIDES.map((s) => (s * dpr) / TILE_H);
/** The grid's zoom as a percentage (a tile of 16 css px is 100%). */
export const percentOf = (zoom: number, dpr: number): number => Math.round((scaleOf(zoom, dpr) / SIDE_100) * 100);

/** The view one grid step in (dir > 0) or out, keeping the tile under (sx, sy) where it is in the pane asked (the preview shows the nearest renderer level of the shared zoom). From a zoom between steps, the next step in that direction. */
export function zoomed(space: Space, v: View, dpr: number, box: Box, sx: number, sy: number, dir: number): View {
  const levels = gridLadder(dpr);
  const eps = 1e-9;
  const next = dir > 0 ? levels.find((l) => l > v.zoom + eps) : [...levels].reverse().find((l) => l < v.zoom - eps);
  const zoom = next ?? (dir > 0 ? (levels[levels.length - 1] as number) : (levels[0] as number));
  if (zoom === v.zoom) return v;
  const shown = (z: number): number => (space === 'iso' ? nearestLevel(z, dpr) : z);
  const under = toTile(space, { ...v, zoom: shown(v.zoom) }, dpr, box, sx, sy);
  const after = toTile(space, { ...v, zoom: shown(zoom) }, dpr, box, sx, sy);
  return { ...v, zoom, cx: v.cx + (under.x - after.x), cy: v.cy + (under.y - after.y) };
}

/** The largest grid step at which a w x h tile area fits the pane (the smallest step when none does), capped at the top step. */
function stepFitting(w: number, h: number, dpr: number, box: Box): number {
  const levels = gridLadder(dpr);
  let zoom = levels[0] as number;
  for (const l of levels) if (w * scaleOf(l, dpr) <= box.w && h * scaleOf(l, dpr) <= box.h) zoom = l;
  return zoom;
}

/** A view that fits a tile rectangle (`x0`..`x1` inclusive, in tiles) in the grid pane with a margin, at the largest grid step that fits. */
export function fitRect(x0: number, y0: number, x1: number, y1: number, dpr: number, box: Box, margin = 1): View {
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, zoom: stepFitting(x1 - x0 + 1 + 2 * margin, y1 - y0 + 1 + 2 * margin, dpr, box) };
}

/** A view centred on a design of w x h tiles at the largest grid step that fits it in the grid pane (with a margin). */
export function fitted(w: number, h: number, dpr: number, box: Box): View {
  return { cx: (w - 1) / 2, cy: (h - 1) / 2, zoom: stepFitting(w / 0.92, h / 0.92, dpr, box) };
}
