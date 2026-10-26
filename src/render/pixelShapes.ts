/** Hard-edged shapes on the art-pixel grid for the in-code overlays: each returns whole-pixel points (1 point = 1 art pixel). */

export interface Px {
  x: number;
  y: number;
}

/** Ellipse outline, one pixel thick, centred on (cx, cy). */
export function ellipsePx(cx: number, cy: number, rx: number, ry: number): Px[] {
  const seen = new Set<string>();
  const out: Px[] = [];
  const steps = Math.max(8, Math.ceil(Math.max(rx, ry) * 8));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const p = { x: Math.round(cx + Math.cos(a) * rx), y: Math.round(cy + Math.sin(a) * ry) };
    const k = `${p.x},${p.y}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

/** Bresenham line between two pixels, both ends included, in drawing order. */
export function linePx(x0: number, y0: number, x1: number, y1: number): Px[] {
  let [x, y] = [Math.round(x0), Math.round(y0)];
  const [ex, ey] = [Math.round(x1), Math.round(y1)];
  const dx = Math.abs(ex - x);
  const dy = -Math.abs(ey - y);
  const sx = x < ex ? 1 : -1;
  const sy = y < ey ? 1 : -1;
  let err = dx + dy;
  const out: Px[] = [{ x, y }];
  while (x !== ex || y !== ey) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
    out.push({ x, y });
  }
  return out;
}

/** Keep `on` pixels, skip `off`, along an ordered run of pixels (a dashed line). `phase` carries the pattern across segments. */
export function dashPx(run: readonly Px[], on: number, off: number, phase = 0): Px[] {
  return run.filter((_, i) => (i + phase) % (on + off) < on);
}

/** A downward-pointing triangle of `rows` rows (widest 2 * rows - 1) whose tip pixel is at (x, tipY). */
export function arrowHeadPx(x: number, tipY: number, rows: number): Px[] {
  const out: Px[] = [];
  for (let r = 0; r < rows; r++) for (let dx = -r; dx <= r; dx++) out.push({ x: x + dx, y: tipY - r });
  return out;
}

/** A filled w x h block with its top-left pixel at (x, y). */
export function blockPx(x: number, y: number, w: number, h: number): Px[] {
  const out: Px[] = [];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) out.push({ x: x + i, y: y + j });
  return out;
}
