/** Where an off-screen marker sits: its centre in viewport CSS px and the direction toward the target (degrees, 0 = right, clockwise). */
export interface Place { x: number; y: number; angle: number }

/**
 * The safe rectangle for marker centres: clear of the top bars (nav strip, crew cards), the right column (log, time, goals, jobs, alerts) and the
 * bottom dock, with room for the marker's own size.
 */
export function safeRect(w: number, h: number): { l: number; t: number; r: number; b: number } {
  return { l: 100, t: 130, r: Math.max(w - 340, 200), b: Math.max(h - 120, 200) };
}

/** The marker for a target at screen point `at`, or null when it is inside the safe rectangle (visible, no marker). The marker lies on the line from the screen centre to the target, on the rectangle's edge. */
export function markerPlace(at: { x: number; y: number }, w: number, h: number): Place | null {
  const { l, t, r, b } = safeRect(w, h);
  if (at.x >= l && at.x <= r && at.y >= t && at.y <= b) return null;
  const cx = w / 2, cy = h / 2;
  const dx = at.x - cx, dy = at.y - cy;
  if (dx === 0 && dy === 0) return null;
  const tx = dx > 0 ? (r - cx) / dx : dx < 0 ? (l - cx) / dx : Infinity;
  const ty = dy > 0 ? (b - cy) / dy : dy < 0 ? (t - cy) / dy : Infinity;
  const k = Math.min(tx, ty);
  return { x: Math.round(cx + dx * k), y: Math.round(cy + dy * k), angle: Math.round((Math.atan2(dy, dx) * 180) / Math.PI) };
}

/** Marker size used to keep neighbours apart (CSS px): the widest a marker gets and its height plus a gap. */
const MARK_W = 180;
const MARK_H = 32;

/** Move markers that would overlap an earlier one inward (up from the lower half of the screen, down from the upper) in steps of one marker height. Keeps them inside the safe rectangle. */
export function spread<T extends Place>(places: readonly T[], h: number): T[] {
  const out: T[] = [];
  for (const p of places) {
    let y = p.y;
    const dir = y > h / 2 ? -1 : 1;
    while (out.some((o) => Math.abs(o.x - p.x) < MARK_W && Math.abs(o.y - y) < MARK_H)) y += dir * MARK_H;
    out.push({ ...p, y });
  }
  return out;
}
