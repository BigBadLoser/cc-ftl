/** 2:1 isometric projection. Art pixels at 1x; tile (x, y)'s floor-diamond centre is iso(x, y). */
export const TILE_W = 128;
export const TILE_H = 64;
/**
 * Art scale against the 64x32-tile baseline all hand-tuned pixel literals were written at. Any render-side pixel offset,
 * size or speed that is really a fraction of a tile or of a height is written `n * ART_SCALE` (), so the
 * art can change resolution by changing TILE_W alone. Screen-space UI (CSS px, device-px line widths) is not scaled.
 */
export const ART_SCALE = TILE_W / 64;

const HW = TILE_W / 2;
const HH = TILE_H / 2;

export interface Pt {
  x: number;
  y: number;
}

/** Grid (fractional) tile coordinates -> art px. Integer coordinates are tile centres. */
export function iso(gx: number, gy: number): Pt {
  return { x: (gx - gy) * HW, y: (gx + gy) * HH };
}

/** Art px -> fractional grid coordinates (integers are tile centres). */
export function unIso(ax: number, ay: number): Pt {
  const u = ax / HW;
  const v = ay / HH;
  return { x: (u + v) / 2, y: (v - u) / 2 };
}

/** Tile whose floor diamond contains an art-px point. Exact for diamonds (|dx|+|dy| < 0.5 in grid space). */
export function tileAt(ax: number, ay: number): Pt {
  const p = unIso(ax, ay);
  return { x: Math.floor(p.x + 0.5), y: Math.floor(p.y + 0.5) };
}

/** Depth key: larger draws later. Multi-tile things pass their front-most footprint tile. */
export const depthKey = (gx: number, gy: number): number => gx + gy;
