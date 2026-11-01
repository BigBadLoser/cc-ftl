import { ART_SCALE } from './iso';

/**
 * Every fractional scale is a whole number of these (1/16): the half tile (64 x 32 world px) then spans a whole number
 * of device px, so tiles and the sprites anchored on them land on the same device px. At 1/3 or 1/6 it spans 21.33 or
 * 10.67 px, and with `roundPixels` each piece rounds on its own: neighbours end up a px apart (seams, off-by-one).
 */
export const SCALE_QUANTUM = 1 / 16;

/**
 * Zoom levels (device px per world px) of the main camera. The rule (#187): one art pixel is ART_SCALE world px, so a level
 * must give a whole number of device px per art px (zoom x ART_SCALE integer): the whole levels from 1 up, and
 * `1 / ART_SCALE` (1 device px per art px). Below that, only 1/4 and 1/8 (the art shrunk by an exact 2 and 4 for framing station hubs),
 * which are powers of two so the filter averages whole blocks. 3/16, 3/8 and 3/4 were dropped: they map an art px to 0.375, 0.75 and
 * 1.5 device px and shimmer. The renderer draws every level below 1 with linear filtering (`scene.ts` `setSmooth`).
 */
const BELOW_ONE: readonly number[] = [...new Set([1 / 8, 1 / 4, 1 / ART_SCALE, 1 / 2])].filter((z) => z < 1).sort((a, b) => a - b);

/** A scale snapped down to an aligned one: a whole number from 1 up, a whole number of SCALE_QUANTUM below (at least one). */
export function alignedScale(s: number): number {
  if (s >= 1) return Math.floor(s + 1e-9);
  return Math.max(SCALE_QUANTUM, Math.floor(s / SCALE_QUANTUM + 1e-9) * SCALE_QUANTUM);
}

/** Every allowed zoom up to `max`, ascending. */
export function zoomLevels(max: number): number[] {
  const out = BELOW_ONE.filter((z) => z < 1 && z <= max);
  for (let z = 1; z <= max; z++) out.push(z);
  return out;
}

/** Largest level not above `z` (the smallest level when `z` is below all of them): "the biggest zoom that still fits". */
export function floorLevel(levels: readonly number[], z: number): number {
  let best = levels[0] as number;
  for (const l of levels) if (l <= z + 1e-9) best = l;
  return best;
}

/** The level closest to `z` on a log scale. */
export function nearestLevel(levels: readonly number[], z: number): number {
  let best = levels[0] as number;
  for (const l of levels) if (Math.abs(Math.log(l / z)) < Math.abs(Math.log(best / z))) best = l;
  return best;
}

/**
 * Pixel-perfect camera. The view centre is a point in art px; one art px is always `zoom`
 * device px (a whole number from 1 up, see `zoomLevels`), and the world container sits on a whole device px.
 */
export interface Camera {
  readonly zoom: number;
  /** Device px per art px (a zoom level: whole from 1 up, fractional only below 1). */
  readonly scale: number;
  /** Canvas size in device px. */
  readonly w: number;
  readonly h: number;
  /** World container position in device px (whole numbers). */
  readonly originX: number;
  readonly originY: number;
  resize(cssW: number, cssH: number, dpr: number): void;
  /** Drag by a delta in CSS px. */
  pan(dx: number, dy: number): void;
  /** Continuous zoom factor from wheel/pinch/keys, accumulated into level steps. */
  zoomAt(factor: number, sx: number, sy: number): void;
  /** Snap to the nearest zoom level. */
  setZoom(zoom: number, sx?: number, sy?: number): void;
  /** Zoom to the largest level that does not exceed `fit` (the zoom at which a framed thing just fits). */
  fitZoom(fit: number): void;
  /** Set an exact device-px-per-art-px scale (may be fractional; the combat panel fits a ship with it). */
  setExactScale(scale: number): void;
  centerOn(ax: number, ay: number): void;
  /** CSS px (canvas-relative) -> art px. */
  toArt(sx: number, sy: number): { x: number; y: number };
}

const STEP_UP = 1.14;

export function createCamera(maxZoom: number): Camera {
  let zoom = 1;
  let levels: number[] = zoomLevels(maxZoom);
  let dprInt = 1;
  let ratio = 1; // device px per css px
  let w = 1;
  let h = 1;
  let cx = 0;
  let cy = 0;
  let acc = 1;
  /** Device px per art px: a zoom level, so art pixels stay crisp (whole numbers) or are filtered (below 1). */
  const scale = () => zoom;
  let sized = false;
  const cam: Camera = {
    get zoom() {
      return zoom;
    },
    get scale() {
      return scale();
    },
    get w() {
      return w;
    },
    get h() {
      return h;
    },
    get originX() {
      return Math.round(w / 2 - cx * scale());
    },
    get originY() {
      return Math.round(h / 2 - cy * scale());
    },
    resize(cssW, cssH, dpr) {
      ratio = Math.max(1, dpr);
      dprInt = Math.max(1, Math.round(dpr));
      // `maxZoom` and the starting zoom are in the 64 px-tile art's terms (art px = css px x dpr at the start): divide them
      // by ART_SCALE so the default and maximum take about the same screen size as before (rounded up to a whole level).
      levels = zoomLevels(Math.max(1, Math.ceil((maxZoom * dprInt) / ART_SCALE - 1e-9)));
      if (!sized) {
        zoom = nearestLevel(levels, dprInt / ART_SCALE);
        sized = true;
      }
      zoom = nearestLevel(levels, Math.min(zoom, levels[levels.length - 1] as number));
      w = Math.max(1, Math.round(cssW * ratio));
      h = Math.max(1, Math.round(cssH * ratio));
    },
    pan(dx, dy) {
      cx -= (dx * ratio) / scale();
      cy -= (dy * ratio) / scale();
    },
    zoomAt(factor, sx, sy) {
      acc *= factor;
      const i = levels.indexOf(zoom);
      if (acc >= STEP_UP) cam.setZoom(levels[Math.min(levels.length - 1, i + 1)] as number, sx, sy);
      else if (acc <= 1 / STEP_UP) cam.setZoom(levels[Math.max(0, i - 1)] as number, sx, sy);
      else return;
      acc = 1;
    },
    fitZoom(fit) {
      cam.setZoom(floorLevel(levels, fit));
    },
    setZoom(z, sx, sy) {
      z = nearestLevel(levels, z);
      if (z === zoom) return;
      const a = sx === undefined || sy === undefined ? { x: cx, y: cy } : cam.toArt(sx, sy);
      const px = sx === undefined ? w / 2 : sx * ratio;
      const py = sy === undefined ? h / 2 : sy * ratio;
      zoom = z;
      cx = a.x - (px - w / 2) / scale();
      cy = a.y - (py - h / 2) / scale();
    },
    setExactScale(s) {
      // Snapped down to an aligned scale, so the panel's tiles and sprites stay on whole device px (see SCALE_QUANTUM).
      zoom = alignedScale(s);
    },
    centerOn(ax, ay) {
      cx = ax;
      cy = ay;
    },
    toArt(sx, sy) {
      return { x: (sx * ratio - cam.originX) / scale(), y: (sy * ratio - cam.originY) / scale() };
    },
  };
  return cam;
}
