/** A screen rectangle in viewport CSS px. */
export interface Rect { l: number; t: number; r: number; b: number }

/**
 * Where an off-screen marker sits. `x`/`y` is the arrow's centre on the screen edge, `edge` the side it hugs, `angle` the direction toward the target
 * (degrees, 0 = right, clockwise) and `ux`/`uy` the same as a unit vector. The icon sits `ICON_GAP` px behind the arrow on the line toward the screen
 * centre, so it orbits the arrow as the direction changes. `grow` is the side the name opens to on hover (away from the arrow), and `room` the width
 * free there before the screen edge or a HUD rectangle.
 */
export interface Place { x: number; y: number; edge: 'l' | 'r' | 't' | 'b'; angle: number; ux: number; uy: number; grow: 'l' | 'r'; room: number }

/** Distance from the arrow's centre to the icon's centre (CSS px). */
export const ICON_GAP = 28;
/** Gap between a marker and the screen edge. */
export const EDGE = 24;
/** The arrow-and-icon footprint used to keep it clear of the HUD and its neighbours (CSS px): its extent along the edge and across it, and the gap. */
const FOOT = 68;
const DEPTH = 64;
/** Icon half-size, for measuring the room beside it. */
const ICON_R = 14;
/** The widest the hover-expanded name may get. */
const NAME_MAX = 170;
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

/** The HUD rectangles in the way of a marker on `edge`, as spans along that edge: those overlapping the band the arrow and icon fill across it. */
function edgeSpans(edge: Place['edge'], w: number, h: number, hud: readonly Rect[]): { from: number; to: number }[] {
  const l = EDGE, r = w - EDGE, t = EDGE, b = h - EDGE;
  if (edge === 'l' || edge === 'r') {
    const bx0 = edge === 'l' ? l - 12 : r - DEPTH + 12, bx1 = edge === 'l' ? l - 12 + DEPTH : r + 12;
    return hud.filter((q) => q.r > bx0 && q.l < bx1).map((q) => ({ from: q.t, to: q.b }));
  }
  const by0 = edge === 't' ? t - 12 : b - DEPTH + 12, by1 = edge === 't' ? t - 12 + DEPTH : b + 12;
  return hud.filter((q) => q.b > by0 && q.t < by1).map((q) => ({ from: q.l, to: q.r }));
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
 * Which side the name opens to for a marker whose arrow is at (x, y) pointing along (ux, uy), and how wide it can be there: the icon sits behind the
 * arrow, so the name opens away from the arrow (to the left for a target on the right), up to the screen margin or the nearest HUD rectangle.
 */
export function nameSide(x: number, y: number, ux: number, uy: number, w: number, h: number, hud: readonly Rect[]): { grow: 'l' | 'r'; room: number } {
  const l = EDGE, r = w - EDGE;
  const ix = x - ux * ICON_GAP, iy = y - uy * ICON_GAP;
  const x0 = ix - ICON_R, x1 = ix + ICON_R, y0 = iy - ICON_R, y1 = iy + ICON_R;
  const roomTo = (dir: 'l' | 'r'): number => {
    const lim = dir === 'r' ? r - x1 : x0 - l;
    const hits = hud.filter((q) => q.b > y0 - GAP && q.t < y1 + GAP && (dir === 'r' ? q.l >= x1 - 1 : q.r <= x0 + 1)).map((q) => (dir === 'r' ? q.l - GAP - x1 : x0 - (q.r + GAP)));
    return Math.max(0, Math.min(lim, ...hits));
  };
  const grow: 'l' | 'r' = Math.abs(ux) < 0.2 ? (roomTo('r') >= roomTo('l') ? 'r' : 'l') : ux > 0 ? 'l' : 'r';
  return { grow, room: Math.max(0, Math.round(Math.min(NAME_MAX, roomTo(grow) - 4))) };
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
  const ux = dx / Math.hypot(dx, dy), uy = dy / Math.hypot(dx, dy);
  const finish = (edge: Place['edge'], x: number, y: number): Place => ({ x: Math.round(x), y: Math.round(y), edge, angle, ux: Math.round(ux * 1000) / 1000, uy: Math.round(uy * 1000) / 1000, ...nameSide(x, y, ux, uy, w, h, hud) });
  if (tx < ty) {
    // Left or right edge: slide along y; the arrow and icon fill [edge, edge + DEPTH] across.
    const edge = dx > 0 ? 'r' : 'l';
    return finish(edge, edge === 'l' ? l : r, slide(py, t + FOOT / 2, b - FOOT / 2, FOOT / 2, edgeSpans(edge, w, h, hud)));
  }
  const edge = dy > 0 ? 'b' : 't';
  return finish(edge, slide(px, l + FOOT / 2, r - FOOT / 2, FOOT / 2, edgeSpans(edge, w, h, hud)), edge === 't' ? t : b);
}

/**
 * Keep markers from overlapping each other. A marker that collides with an earlier one moves along its edge to the nearest slot (trying both directions,
 * a footprint at a time) that stays inside the edge's range, clear of every HUD rectangle and clear of the earlier markers. When no slot fits, the marker
 * is dropped rather than left under the HUD or off the screen.
 */
export function spread<T extends Place>(places: readonly T[], w: number, h: number, hud: readonly Rect[] = []): T[] {
  const out: T[] = [];
  const step = FOOT + GAP;
  for (const p of places) {
    const vertical = p.edge === 'l' || p.edge === 'r';
    const along = vertical ? p.y : p.x;
    const lo = EDGE + FOOT / 2, hi = (vertical ? h : w) - EDGE - FOOT / 2;
    const spans = edgeSpans(p.edge, w, h, hud);
    const clearOfHud = (c: number) => !spans.some((q) => c + FOOT / 2 + GAP > q.from && c - FOOT / 2 - GAP < q.to);
    const free = (c: number) => c >= lo && c <= hi && clearOfHud(c) && !out.some((o) => (vertical ? Math.abs(o.x - p.x) < step && Math.abs(o.y - c) < step : Math.abs(o.y - p.y) < step && Math.abs(o.x - c) < step));
    // Candidate slots: where it is, one step either side of each earlier marker, and just clear of each HUD span. The nearest free one wins.
    const cand = [along, ...out.flatMap((o) => { const c = vertical ? o.y : o.x; return [c - step, c + step]; }), ...spans.flatMap((q) => [q.from - FOOT / 2 - GAP, q.to + FOOT / 2 + GAP])];
    const at = cand.filter(free).reduce<number | null>((best, c) => (best === null || Math.abs(c - along) < Math.abs(best - along) ? c : best), null);
    if (at === null) continue;
    // Measure the name's room where the marker finally sits, not where it was first placed.
    const moved = vertical ? { ...p, y: at } : { ...p, x: at };
    out.push({ ...moved, ...nameSide(moved.x, moved.y, p.ux, p.uy, w, h, hud) });
  }
  return out;
}
