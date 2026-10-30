export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Size { w: number; h: number }

const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * Where a floating panel of `size` goes beside `anchor` (a module's screen bounds): right of it first, then left, above, below, each `gap` away and
 * clamped into `view` (inset by `margin`). The first spot that covers neither the anchor nor an obstacle wins; if none is clear, the one that
 * overlaps the obstacles least. Returns null when the anchor is wholly outside the view (the panel hides).
 */
export function placePanel(anchor: Rect, size: Size, view: Size, obstacles: Rect[], gap = 12, margin = 8): { x: number; y: number } | null {
  if (anchor.x1 <= 0 || anchor.y1 <= 0 || anchor.x0 >= view.w || anchor.y0 >= view.h) return null;
  const cx = (anchor.x0 + anchor.x1) / 2 - size.w / 2;
  const cy = (anchor.y0 + anchor.y1) / 2 - size.h / 2;
  const spots = [
    { x: anchor.x1 + gap, y: cy },
    { x: anchor.x0 - gap - size.w, y: cy },
    { x: cx, y: anchor.y0 - gap - size.h },
    { x: cx, y: anchor.y1 + gap },
  ];
  const clamp = (v: number, size2: number, max: number) => Math.max(margin, Math.min(v, max - size2 - margin));
  let best: { x: number; y: number } | null = null;
  let bestCost = Infinity;
  for (const s of spots) {
    const x = clamp(s.x, size.w, view.w);
    const y = clamp(s.y, size.h, view.h);
    const r = { x0: x, y0: y, x1: x + size.w, y1: y + size.h };
    const cost = (hit(r, anchor) ? 1e6 : 0) + obstacles.filter((o) => hit(r, o)).length * 1000 + Math.abs(x - s.x) + Math.abs(y - s.y);
    if (cost < bestCost) {
      best = { x, y };
      bestCost = cost;
    }
  }
  return best;
}
