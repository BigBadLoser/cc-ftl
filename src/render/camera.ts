import { ART_SCALE } from './iso';

/**
 * Zoom levels (device px per art px) of the main camera: one ladder at any art scale. From 1 up they are whole numbers,
 * so the art stays crisp with nearest-neighbour. Below 1 come fractional levels down to 1/8: framing things far bigger
 * than a ship (station hubs), and at 2x art (TILE_W 128) `1 / ART_SCALE` is the old zoom 1. The renderer draws every
 * level below 1 with linear filtering (`scene.ts` `setSmooth`) so the pixel art does not shimmer when shrunk.
 */
const BELOW_ONE: readonly number[] = [...new Set([1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / ART_SCALE, 1 / 2, 0.75])].filter((z) => z < 1).sort((a, b) => a - b);

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
  /** Device px per art px (a zoom level: whole from 1 up, fractional only below 1 at 2x art). */
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
      // `maxZoom` and the starting zoom are in the 64 px-tile art's terms (art px = css px x dpr at the start): halve them
      // at 2x art so the default and maximum take about the same screen size as before (rounded up to a whole level).
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
      zoom = s;
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
