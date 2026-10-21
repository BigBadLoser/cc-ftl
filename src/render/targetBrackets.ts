import { iso } from './iso';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Art px a module's body rises above its floor diamond; the bracket rect grows upward by about this much. */
export const MODULE_RISE = 10;

/**
 * Screen-space bounding rect of a module's iso footprint. `tx, ty, w, h` are the rotated footprint as the sim stores it
 * (top-left tile and size, sector tiles), `origin` is added to the tile (0 in the sector frame), `lift` is the view's
 * roof lift in art px (the same one `pick()` adds back), `rise` grows the rect upward for the module's height, and
 * `project` maps art px to screen px (the combat camera, so the rect lines up with picking).
 */
export function footprintRect(
  tx: number, ty: number, w: number, h: number,
  origin: { x: number; y: number }, lift: number,
  project: (ax: number, ay: number) => { x: number; y: number },
  rise = 0,
): Rect {
  const x0 = origin.x + tx - 0.5;
  const y0 = origin.y + ty - 0.5;
  const x1 = x0 + w;
  const y1 = y0 + h;
  // Diamond corners: top (x0,y0), right (x1,y0), left (x0,y1), bottom (x1,y1).
  const top = iso(x0, y0);
  const right = iso(x1, y0);
  const left = iso(x0, y1);
  const bottom = iso(x1, y1);
  const a = project(left.x, top.y - lift - rise);
  const b = project(right.x, bottom.y - lift);
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
}

export const ARM_MIN = 4;
export const ARM_MAX = 10;

/** Arm length of a bracket corner: a quarter of the side, clamped to 4..10 px (and never more than half the side). */
export function armLength(side: number): number {
  return Math.min(side / 2, Math.max(ARM_MIN, Math.min(ARM_MAX, side * 0.25)));
}

/** Four L-shaped corner brackets (8 segments) around a rect. */
export function bracketSegments(r: Rect): Seg[] {
  const ax = armLength(r.w);
  const ay = armLength(r.h);
  const x2 = r.x + r.w;
  const y2 = r.y + r.h;
  return [
    { x1: r.x, y1: r.y + ay, x2: r.x, y2: r.y }, { x1: r.x, y1: r.y, x2: r.x + ax, y2: r.y },
    { x1: x2 - ax, y1: r.y, x2: x2, y2: r.y }, { x1: x2, y1: r.y, x2: x2, y2: r.y + ay },
    { x1: x2, y1: y2 - ay, x2: x2, y2 }, { x1: x2, y1: y2, x2: x2 - ax, y2 },
    { x1: r.x + ax, y1: y2, x2: r.x, y2 }, { x1: r.x, y1: y2, x2: r.x, y2: y2 - ay },
  ];
}
