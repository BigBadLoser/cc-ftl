/**
 * Pixel-perfect camera. The view centre is a point in art px; one art px is always `zoom`
 * whole device px, and the world container sits on a whole device px.
 */
export interface Camera {
  readonly zoom: number;
  /** Device px per art px (integer). */
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
  /** Continuous zoom factor from wheel/pinch/keys, accumulated into integer steps. */
  zoomAt(factor: number, sx: number, sy: number): void;
  setZoom(zoom: number, sx?: number, sy?: number): void;
  /** Set an exact device-px-per-art-px scale (may be fractional; the combat panel fits a ship with it). */
  setExactScale(scale: number): void;
  centerOn(ax: number, ay: number): void;
  /** CSS px (canvas-relative) -> art px. */
  toArt(sx: number, sy: number): { x: number; y: number };
}

const STEP_UP = 1.14;

export function createCamera(maxZoom: number): Camera {
  let zoom = 1;
  let dprInt = 1;
  let ratio = 1; // device px per css px
  let w = 1;
  let h = 1;
  let cx = 0;
  let cy = 0;
  let acc = 1;
  /** Device px per art px. Always an integer, so art pixels stay crisp. */
  const scale = () => zoom;
  let maxScale = maxZoom;
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
      maxScale = maxZoom * dprInt;
      if (!sized) {
        zoom = dprInt;
        sized = true;
      }
      zoom = Math.min(zoom, maxScale);
      w = Math.max(1, Math.round(cssW * ratio));
      h = Math.max(1, Math.round(cssH * ratio));
    },
    pan(dx, dy) {
      cx -= (dx * ratio) / scale();
      cy -= (dy * ratio) / scale();
    },
    zoomAt(factor, sx, sy) {
      acc *= factor;
      if (acc >= STEP_UP) cam.setZoom(zoom + 1, sx, sy);
      else if (acc <= 1 / STEP_UP) cam.setZoom(zoom - 1, sx, sy);
      else return;
      acc = 1;
    },
    setZoom(z, sx, sy) {
      z = Math.max(1, Math.min(maxScale, Math.round(z)));
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
