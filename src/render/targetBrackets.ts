import { ART_SCALE, iso } from './iso';

export interface Pt {
  x: number;
  y: number;
}

/** The four projected corners of a module's iso footprint, in screen space. */
export interface Quad {
  top: Pt;
  right: Pt;
  bottom: Pt;
  left: Pt;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Art px a module's body rises above its floor diamond; the quad's top vertex is raised by about this much. */
export const MODULE_RISE = 10 * ART_SCALE;

/**
 * Screen-space quad (a parallelogram for non-square footprints) of a module's iso footprint. `tx, ty, w, h` are the
 * rotated footprint as the sim stores it (top-left tile and size, sector tiles), `origin` is added to the tile (0 in the
 * sector frame), `lift` is the view's roof lift in art px (the same one `pick()` adds back), `rise` raises the two
 * top-side vertices for the module's height, and `project` maps art px to screen px (the combat camera).
 */
export function footprintQuad(
  tx: number, ty: number, w: number, h: number,
  origin: { x: number; y: number }, lift: number,
  project: (ax: number, ay: number) => Pt,
  rise = 0,
): Quad {
  const x0 = origin.x + tx - 0.5;
  const y0 = origin.y + ty - 0.5;
  const x1 = x0 + w;
  const y1 = y0 + h;
  const at = (gx: number, gy: number, up: number): Pt => {
    const a = iso(gx, gy);
    return project(a.x, a.y - lift - up);
  };
  return { top: at(x0, y0, rise), right: at(x1, y0, rise / 2), bottom: at(x1, y1, 0), left: at(x0, y1, rise / 2) };
}

/** Bracket arms are drawn in the projected (device px) frame, so these are screen-space and do not scale with the art. */
export const ARM_MIN = 4;
export const ARM_MAX = 10;

/** Arm length along an edge: a quarter of its length, clamped to 4..10 device px (and never more than half the edge). */
export function armLength(side: number): number {
  return Math.min(side / 2, Math.max(ARM_MIN, Math.min(ARM_MAX, side * 0.25)));
}

/** Move the quad's corners outward from its centre along the diagonals by `pad` px. */
export function padQuad(q: Quad, pad: number): Quad {
  if (pad === 0) return q;
  const cx = (q.top.x + q.bottom.x) / 2;
  const cy = (q.top.y + q.bottom.y) / 2;
  const out = (p: Pt): Pt => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / d) * pad, y: p.y + (dy / d) * pad };
  };
  return { top: out(q.top), right: out(q.right), bottom: out(q.bottom), left: out(q.left) };
}

/**
 * Corner brackets along the iso edges: at each of the 4 vertices, two arms running along the two quad edges that meet
 * there (8 segments, each from the vertex outward). Arms are about 25% of their edge, clamped to 4..10 px.
 */
export function isoBracketSegments(q: Quad): Seg[] {
  const ring = [q.top, q.right, q.bottom, q.left];
  const out: Seg[] = [];
  for (let i = 0; i < 4; i++) {
    const v = ring[i] as Pt;
    for (const n of [ring[(i + 1) % 4], ring[(i + 3) % 4]] as Pt[]) {
      const dx = n.x - v.x;
      const dy = n.y - v.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const a = armLength(len);
      out.push({ x1: v.x, y1: v.y, x2: v.x + (dx / len) * a, y2: v.y + (dy / len) * a });
    }
  }
  return out;
}
