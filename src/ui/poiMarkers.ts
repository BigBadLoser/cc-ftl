/** A screen rectangle in viewport CSS px. */
export interface Rect { l: number; t: number; r: number; b: number }

/**
 * Where an off-screen marker sits: `x`/`y` is the anchor point on the screen edge (CSS px), `edge` the side it hugs, `angle` the direction toward
 * the target (degrees, 0 = right, clockwise), and `tx`/`ty` the percentages the marker is translated by so it lies inside the screen from the anchor
 * (a marker on the right edge hangs left of its anchor, one on the top edge is centred on it).
 */
export interface Place { x: number; y: number; edge: 'l' | 'r' | 't' | 'b'; angle: number; tx: number; ty: number }

/** Gap between a marker and the screen edge. */
export const EDGE = 24;
/** Marker size used to keep it clear of the HUD and its neighbours (CSS px): the widest a marker gets, its height and the gap. */
const MARK_W = 180;
const MARK_H = 28;
const GAP = 6;

/** The page's HUD rectangles: the nav strip, the crew bar and node strip, the right column cards, the tool dock and the build menu. */
export const HUD_SELECTOR = '[data-testid=navstrip], header .mid > *, .rcol .frame, .rcol .cards > *, .rcol > :not(.cards):not(.frame), [data-testid=toolbar] .dock, [data-testid=build-catalog]';

export function measureHud(doc: Pick<Document, 'querySelectorAll'>): Rect[] {
  const out: Rect[] = [];
  for (const el of doc.querySelectorAll(HUD_SELECTOR)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) out.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  }
  return out;
}

const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b;

/** Slide a marker's centre `c` along an edge (range lo..hi) until its box (`half` each side, plus the gap) clears every rect that overlaps it; `across` tests overlap on the other axis. */
function slide(c: number, lo: number, hi: number, half: number, rects: readonly { from: number; to: number }[]): number {
  let v = Math.min(hi, Math.max(lo, c));
  for (let pass = 0; pass < 8; pass++) {
    const hit = rects.find((r) => v + half + GAP > r.from && v - half - GAP < r.to);
    if (!hit) break;
    const down = hit.from - half - GAP, up = hit.to + half + GAP;
    const opts = [down, up].filter((x) => x >= lo && x <= hi);
    if (!opts.length) break;
    v = opts.reduce((a, b) => (Math.abs(a - v) <= Math.abs(b - v) ? a : b));
  }
  return v;
}

/**
 * The marker for a target at screen point `at`, or null when the target is on screen and not behind the HUD. The marker lies on the line from the
 * screen centre toward the target, on the edge of the screen rectangle inset by `EDGE`; along that edge it slides clear of the HUD rectangles.
 */
export function markerPlace(at: { x: number; y: number }, w: number, h: number, hud: readonly Rect[] = []): Place | null {
  if (at.x >= 0 && at.x <= w && at.y >= 0 && at.y <= h && !hud.some((r) => inside(at, r))) return null;
  const cx = w / 2, cy = h / 2;
  const dx = at.x - cx, dy = at.y - cy;
  if (dx === 0 && dy === 0) return null;
  const l = EDGE, r = w - EDGE, t = EDGE, b = h - EDGE;
  const tx = dx > 0 ? (r - cx) / dx : dx < 0 ? (l - cx) / dx : Infinity;
  const ty = dy > 0 ? (b - cy) / dy : dy < 0 ? (t - cy) / dy : Infinity;
  const k = Math.min(tx, ty);
  const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
  const px = cx + dx * k, py = cy + dy * k;
  if (tx < ty) {
    // Left or right edge: slide along y. The marker's box lies horizontally in [EDGE, EDGE + MARK_W] or the mirror.
    const edge = dx > 0 ? 'r' : 'l';
    const bx0 = edge === 'l' ? l : r - MARK_W, bx1 = edge === 'l' ? l + MARK_W : r;
    const rects = hud.filter((q) => q.r > bx0 && q.l < bx1).map((q) => ({ from: q.t, to: q.b }));
    const y = slide(py, t + MARK_H / 2, b - MARK_H / 2, MARK_H / 2, rects);
    return { x: Math.round(edge === 'l' ? l : r), y: Math.round(y), edge, angle, tx: edge === 'l' ? 0 : -100, ty: -50 };
  }
  const edge = dy > 0 ? 'b' : 't';
  const by0 = edge === 't' ? t : b - MARK_H, by1 = edge === 't' ? t + MARK_H : b;
  const rects = hud.filter((q) => q.b > by0 && q.t < by1).map((q) => ({ from: q.l, to: q.r }));
  const x = slide(px, l + MARK_W / 2, r - MARK_W / 2, MARK_W / 2, rects);
  return { x: Math.round(x), y: Math.round(edge === 't' ? t : b), edge, angle, tx: -50, ty: edge === 't' ? 0 : -100 };
}

/** Move a marker that would overlap an earlier one along its edge (away from the screen's corner side) in steps of its own size. */
export function spread<T extends Place>(places: readonly T[], w: number, h: number): T[] {
  const out: T[] = [];
  for (const p of places) {
    let { x, y } = p;
    const vertical = p.edge === 'l' || p.edge === 'r';
    const dir = vertical ? (y > h / 2 ? -1 : 1) : (x > w / 2 ? -1 : 1);
    const hit = () => out.some((o) => Math.abs(o.x - x) < (vertical ? MARK_W : MARK_W + GAP) && Math.abs(o.y - y) < MARK_H + GAP);
    while (hit()) {
      if (vertical) y += dir * (MARK_H + GAP);
      else x += dir * (MARK_W + GAP);
    }
    out.push({ ...p, x, y });
  }
  return out;
}
