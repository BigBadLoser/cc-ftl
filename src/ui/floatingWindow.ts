/**
 * Pure helpers for FloatingWindow: clamping, dragging, edge/corner resizing with a minimum size, the splitter fraction,
 * and the per-panel session memory (position, size, pin). No DOM; storage is injected like cardCollapse.ts.
 */
export interface Rect { x: number; y: number; w: number; h: number }
export interface Size { w: number; h: number }
/** Where a window sits until the player moves it. `h: 0` means as tall as its content (up to the screen); with `anchor: 'bottom'` such a window hangs from the bottom of the bounds instead of `y`. */
export type DefaultRect = Rect & { anchor?: 'bottom' };
/** Edges a resize handle moves: `n`/`s` for the top/bottom edge, `e`/`w` for the right/left one; corners combine two. */
export type Edge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export const EDGES: readonly Edge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

/** The room a window may use: the viewport inset by `top` (below the top bars) and a margin on the other sides. */
export interface Bounds {
  left: number; top: number; right: number; bottom: number;
  /** Default spots only: where the top-right column starts, so centred windows do not default under it when the screen is narrow. */
  clearRight?: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Fit a rect into the bounds: size up to the bounds and at least `min` (the bounds win if they are smaller), then position inside. */
export function clampRect(r: Rect, b: Bounds, min: Size): Rect {
  const w = clamp(r.w, Math.min(min.w, b.right - b.left), b.right - b.left);
  const h = clamp(r.h, Math.min(min.h, b.bottom - b.top), b.bottom - b.top);
  return { x: clamp(r.x, b.left, b.right - w), y: clamp(r.y, b.top, b.bottom - h), w, h };
}

/** A drag of the header by (dx, dy) from the rect it started at. */
export function moveRect(start: Rect, dx: number, dy: number, b: Bounds, min: Size): Rect {
  return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, b, min);
}

/** A resize from `edge` by (dx, dy). The edge opposite the one dragged stays put; the size never drops below `min` or leaves the bounds. */
export function resizeRect(start: Rect, edge: Edge, dx: number, dy: number, b: Bounds, min: Size): Rect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  const mw = Math.min(min.w, b.right - b.left);
  const mh = Math.min(min.h, b.bottom - b.top);
  if (edge.includes('w')) left = clamp(left + dx, b.left, right - mw);
  if (edge.includes('e')) right = clamp(right + dx, left + mw, b.right);
  if (edge.includes('n')) top = clamp(top + dy, b.top, bottom - mh);
  if (edge.includes('s')) bottom = clamp(bottom + dy, top + mh, b.bottom);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** The share of a body of `total` px given to the top part when the splitter sits `offset` px below the body's top; each part keeps its minimum. */
export function splitFraction(offset: number, total: number, minTop: number, minBottom: number): number {
  if (total <= 0) return 0.5;
  const top = clamp(offset, minTop, total - minBottom);
  return clamp(top / total, 0.05, 0.95);
}

/** A default spot centred horizontally in the bounds, `top` px below their top edge (`h: 0` = as tall as its content). */
export function centerTop(b: Bounds, w: number, h = 0, top = 0): DefaultRect {
  const ww = Math.min(w, b.right - b.left);
  const x = Math.max(b.left, Math.min((b.left + b.right - ww) / 2, (b.clearRight ?? b.right) - ww));
  return { x, y: b.top + top, w: ww, h };
}

/** What a window remembers for the browser session: where the player put it (null = still at its default spot) and whether it is pinned. */
export interface WindowState { rect: Rect | null; pinned: boolean }
type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const windowKey = (id: string): string => `cc.window.${id}`;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function readWindow(id: string, store: () => Store = () => sessionStorage): WindowState {
  try {
    const raw = JSON.parse(store().getItem(windowKey(id)) ?? 'null') as { rect?: Partial<Rect> | null; pinned?: unknown } | null;
    const r = raw?.rect;
    const rect = r && finite(r.x) && finite(r.y) && finite(r.w) && finite(r.h) && r.w > 0 && r.h > 0 ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
    return { rect, pinned: raw?.pinned === true };
  } catch {
    return { rect: null, pinned: false };
  }
}

export function writeWindow(id: string, state: WindowState, store: () => Store = () => sessionStorage): void {
  try {
    store().setItem(windowKey(id), JSON.stringify(state));
  } catch {
    /* not remembered */
  }
}

/** Whether the window `id` is pinned: a pinned window ignores the outside click and Esc. */
export const isPinned = (id: string, store?: () => Store): boolean => readWindow(id, store).pinned;

/** A number kept for the session under `key` (e.g. a splitter position); `fallback` when unset, malformed or storage is unavailable. */
export function readNumber(key: string, fallback: number, store: () => Store = () => sessionStorage): number {
  try {
    const v = Number(store().getItem(key));
    return store().getItem(key) !== null && Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

export function writeNumber(key: string, value: number, store: () => Store = () => sessionStorage): void {
  try {
    store().setItem(key, String(value));
  } catch {
    /* not remembered */
  }
}
