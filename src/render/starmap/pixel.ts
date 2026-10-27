/**
 * The starmap's pixel look: lines and outlines drawn as pixel cells on a grid of `g` map units (two screen pixels at the current zoom, so a cell
 * stays the size of the game's art pixels however far the map is zoomed), and shapes built from squares. Lines are Bresenham lines: the cells
 * of a line, merged into one rectangle per run along its major axis, so a straight lane has evenly spaced steps and no elbows. Everything is a
 * list of rectangles (`Ops`) that a Graphics fills. Outlines are cached by path and grid.
 */

/** Lines longer than this many cells are drawn as a plain band (a lane far off-screen at a deep zoom). */
const MAX_CELLS = 3000;

/** Filled shapes: `r` is flat x, y, w, h rectangles; `q` are quads (x, y pairs) for the plain bands. */
export interface Ops {
  r: number[];
  q: number[][];
}
export const newOps = (): Ops => ({ r: [], q: [] });
export const opsEmpty = (o: Ops): boolean => o.r.length === 0 && o.q.length === 0;

/** Line options: `w` its thickness in cells; `dash` [on, off] in cells along it (omitted: solid). */
export interface PixelLineOpts {
  w?: number;
  dash?: readonly [number, number];
}

/** A rectangle of cells, columns i0..i1 and rows j0..j1 (inclusive, cell indices). */
const cellRect = (o: Ops, i0: number, i1: number, j0: number, j1: number, g: number): void => {
  o.r.push((i0 - 0.5) * g, (j0 - 0.5) * g, (i1 - i0 + 1) * g, (j1 - j0 + 1) * g);
};

/** The cells of the Bresenham line from cell (x0, y0) to (x1, y1), as runs along the major axis, thickened to `w` cells and dashed. */
function cells(o: Ops, x0: number, y0: number, x1: number, y1: number, g: number, opt: PixelLineOpts): void {
  const w = Math.max(1, opt.w ?? 1);
  const lo = -Math.floor((w - 1) / 2);
  const hi = lo + w - 1;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x1 >= x0 ? 1 : -1;
  const sy = y1 >= y0 ? 1 : -1;
  const xMajor = dx >= dy;
  const on = (k: number): boolean => !opt.dash || k % (opt.dash[0] + opt.dash[1]) < opt.dash[0];
  // A run: cells from `a` to `b` along the major axis at minor coordinate `m`.
  const emit = (a: number, b: number, m: number) => {
    const [p, q] = a <= b ? [a, b] : [b, a];
    if (xMajor) cellRect(o, p, q, m + lo, m + hi, g);
    else cellRect(o, m + lo, m + hi, p, q, g);
  };
  let x = x0;
  let y = y0;
  let err = dx - dy;
  let start: number | null = null;
  let minor = xMajor ? y : x;
  const n = Math.max(dx, dy);
  for (let k = 0; k <= n; k++) {
    const major = xMajor ? x : y;
    const m = xMajor ? y : x;
    const lit = on(k);
    if (start !== null && (m !== minor || !lit)) {
      emit(start, major - (xMajor ? sx : sy), minor);
      start = null;
    }
    if (lit && start === null) start = major;
    minor = m;
    if (k === n) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  if (start !== null) emit(start, xMajor ? x : y, minor);
}

/** A plain band of `w` cells from (ax, ay) to (bx, by): the fallback for lines too long to draw cell by cell. */
function band(o: Ops, ax: number, ay: number, bx: number, by: number, g: number, w: number): void {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * (w * g) / 2;
  const ny = ((bx - ax) / len) * (w * g) / 2;
  o.q.push([ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny]);
}

/** A lane (or any segment) as a pixel line. */
export function pixelLine(o: Ops, ax: number, ay: number, bx: number, by: number, g: number, opt: PixelLineOpts = {}): void {
  const [x0, y0, x1, y1] = [ax, ay, bx, by].map((v) => Math.round(v / g)) as [number, number, number, number];
  if (Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) > MAX_CELLS) return band(o, ax, ay, bx, by, g, opt.w ?? 1);
  if (opt.dash) dashed(o, x0, y0, x1, y1, g, opt.w ?? 1, opt.dash);
  else cells(o, x0, y0, x1, y1, g, opt);
}

/** Clean slopes (minor over major), whose steps are all alike. */
const CLEAN = [0, 1 / 3, 1 / 2, 1];

/**
 * A dashed line whose every dash is drawn at the clean slope nearest the line's, starting on the true line: the steps of a dash are all alike, and
 * the correction back onto the line falls in the gap after it.
 */
function dashed(o: Ops, x0: number, y0: number, x1: number, y1: number, g: number, w: number, dash: readonly [number, number]): void {
  const xMajor = Math.abs(x1 - x0) >= Math.abs(y1 - y0);
  const [a0, m0, a1, m1] = xMajor ? [x0, y0, x1, y1] : [y0, x0, y1, x1];
  const n = Math.abs(a1 - a0);
  const sa = a1 >= a0 ? 1 : -1;
  const slope = n ? (m1 - m0) / n : 0;
  const near = CLEAN.reduce((b, c) => (Math.abs(c - Math.abs(slope)) < Math.abs(b - Math.abs(slope)) ? c : b), 0);
  const clean = slope < 0 ? -near : near;
  const lo = -Math.floor((w - 1) / 2);
  const cell = (k: number, m: number, len: number) => {
    const a = Math.min(a0 + sa * k, a0 + sa * (k + len - 1));
    if (xMajor) cellRect(o, a, a + len - 1, m + lo, m + lo + w - 1, g);
    else cellRect(o, m + lo, m + lo + w - 1, a, a + len - 1, g);
  };
  for (let k0 = 0; k0 <= n; k0 += dash[0] + dash[1]) {
    const start = m0 + slope * k0;
    const end = Math.min(n, k0 + dash[0] - 1);
    // Runs of equal minor position within the dash.
    let run = k0;
    // The same pattern in every dash (offsets from its first cell), so the dashes along a line all have one shape.
    const first = Math.round(start);
    let cur = first;
    for (let k = k0 + 1; k <= end + 1; k++) {
      const m = k <= end ? first + Math.round(clean * (k - k0)) : NaN;
      if (m !== cur) {
        cell(run, cur, k - run);
        run = k;
        cur = m;
      }
    }
  }
}

/** Rects of whole cells as unique cells in row runs: where two lines of one outline meet, a cell is drawn once (overlaps would double an alpha fill). */
export function mergeCells(o: Ops, g: number): Ops {
  const rows = new Map<number, Set<number>>();
  for (let k = 0; k < o.r.length; k += 4) {
    const i0 = Math.round(o.r[k]! / g + 0.5);
    const j0 = Math.round(o.r[k + 1]! / g + 0.5);
    const w = Math.round(o.r[k + 2]! / g);
    const h = Math.round(o.r[k + 3]! / g);
    for (let j = j0; j < j0 + h; j++) {
      let set = rows.get(j);
      if (!set) rows.set(j, (set = new Set()));
      for (let i = i0; i < i0 + w; i++) set.add(i);
    }
  }
  const out: Ops = { r: [], q: o.q };
  for (const [j, set] of rows) {
    const xs = [...set].sort((a, b) => a - b);
    let a = xs[0]!;
    for (let n = 1; n <= xs.length; n++) {
      if (n < xs.length && xs[n] === xs[n - 1]! + 1) continue;
      cellRect(out, a, xs[n - 1]!, j, j, g);
      a = xs[n]!;
    }
  }
  return out;
}

/** A polyline (flat x, y pairs, as the route is given) as pixel lines. */
export function pixelPolyline(o: Ops, pts: readonly number[], g: number, opt: PixelLineOpts = {}): void {
  const lines = newOps();
  for (let i = 2; i + 1 < pts.length; i += 2) pixelLine(lines, pts[i - 2]!, pts[i - 1]!, pts[i]!, pts[i + 1]!, g, opt);
  const m = mergeCells(lines, g);
  for (const v of m.r) o.r.push(v);
  for (const q of m.q) o.q.push(q);
}

/** The route's "x,y x,y ..." points string as flat numbers. */
export function parsePoints(points: string): number[] {
  const out: number[] = [];
  for (const p of points.trim().split(/\s+/)) {
    const [x, y] = p.split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push(x!, y!);
  }
  return out;
}

const outlines = new Map<string, Ops>();

/** The loops of a closed outline made of M/L/Z loops (`fluidOutline`) as flat x, y lists. */
export function loopsOf(d: string): number[][] {
  const out: number[][] = [];
  for (const loop of d.split(/Z/i)) {
    const nums = loop.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (nums.length >= 6) out.push(nums.length % 2 ? nums.slice(0, -1) : nums);
  }
  return out;
}

/** The border of a closed outline as pixel lines, `w` cells thick. Cached by path and grid; the result is shared, never change it. */
export function pixelOutline(d: string, g: number, w = 1): Ops {
  const key = `${g.toFixed(4)}|${w}|${d}`;
  const hit = outlines.get(key);
  if (hit) return hit;
  const o = newOps();
  for (const pts of loopsOf(d)) {
    for (let i = 2; i <= pts.length; i += 2) {
      const a = (i - 2) % pts.length;
      const b = i % pts.length;
      pixelLine(o, pts[a]!, pts[a + 1]!, pts[b]!, pts[b + 1]!, g, { w });
    }
  }
  const merged = mergeCells(o, g);
  if (outlines.size > 1500) outlines.clear();
  outlines.set(key, merged);
  return merged;
}

/** A square of 2h + 1 cells around the cell of (x, y), h = `r` in cells: on the same cells the lines are drawn on. */
export function pixelSquare(x: number, y: number, r: number, g: number): { x: number; y: number; width: number; height: number } {
  const h = Math.max(0, Math.round(r / g));
  const size = (2 * h + 1) * g;
  return { x: (Math.round(x / g) - h - 0.5) * g, y: (Math.round(y / g) - h - 0.5) * g, width: size, height: size };
}

/** A filled diamond (a square on its corner) of half-size `r` around (x, y), in pixel cells. */
export function pixelDiamond(o: Ops, x: number, y: number, r: number, g: number): void {
  const ci = Math.round(x / g);
  const cj = Math.round(y / g);
  const h = Math.max(1, Math.round(r / g));
  for (let j = -h; j <= h; j++) {
    const half = h - Math.abs(j);
    cellRect(o, ci - half, ci + half, cj + j, cj + j, g);
  }
}

/** An arrowhead pointing east, in cell units: tip, upper back corner, notch, lower back corner. */
const ARROW: readonly [number, number][] = [[3.6, 0], [-3, -3.2], [-1, 0], [-3, 3.2]];

function inside(poly: readonly [number, number][], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/**
 * An arrowhead (the stand-in for a fleet, the player's ship) rasterised into pixel cells of `g` at a heading snapped to 45°, centred on the
 * origin: the cells whose centres fall inside the rotated outline, merged into one rect per run. `scale` stretches the outline (in cells).
 */
export function pixelArrow(o: Ops, deg: number, g: number, scale = 1): void {
  const a = ((Math.round(deg / 45) * 45) * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const poly = ARROW.map(([x, y]): [number, number] => [(x * c - y * sn) * scale, (x * sn + y * c) * scale]);
  const r = Math.ceil(4 * scale);
  for (let j = -r; j <= r; j++) {
    let run: number | null = null;
    for (let i = -r; i <= r + 1; i++) {
      const on = i <= r && inside(poly, i, j);
      if (on && run === null) run = i;
      if (!on && run !== null) {
        cellRect(o, run, i - 1, j, j, g);
        run = null;
      }
    }
  }
}

/**
 * The outline of a pixel diamond of half-size `r` around (x, y), `w` cells thick: the cells whose distance (|dx| + |dy|, in
 * cells) from the centre cell is within `w` of the edge, one rect per run. Matches `pixelDiamond` of the same size.
 */
export function pixelDiamondRing(o: Ops, x: number, y: number, r: number, g: number, w = 1): void {
  const ci = Math.round(x / g);
  const cj = Math.round(y / g);
  const h = Math.max(1, Math.round(r / g));
  const inner = Math.max(0, h - w);
  for (let j = -h; j <= h; j++) {
    const outer = h - Math.abs(j);
    const hole = inner - Math.abs(j);
    if (hole < 0) cellRect(o, ci - outer, ci + outer, cj + j, cj + j, g);
    else {
      cellRect(o, ci - outer, ci - hole - 1, cj + j, cj + j, g);
      cellRect(o, ci + hole + 1, ci + outer, cj + j, cj + j, g);
    }
  }
}

/** The border of a rectangle (map units) `t` thick, as four rects, or dashed along each side when `dash` is given (units: `t`). */
export function rectBorder(o: Ops, x: number, y: number, w: number, h: number, t: number, dash?: readonly [number, number]): void {
  if (!dash) {
    o.r.push(x, y, w, t, x, y + h - t, w, t, x, y + t, t, h - 2 * t, x + w - t, y + t, t, h - 2 * t);
    return;
  }
  const step = (dash[0] + dash[1]) * t;
  for (let p = 0; p < w; p += step) {
    const len = Math.min(dash[0] * t, w - p);
    o.r.push(x + p, y, len, t, x + p, y + h - t, len, t);
  }
  for (let p = t; p < h - t; p += step) {
    const len = Math.min(dash[0] * t, h - t - p);
    o.r.push(x, y + p, t, len, x + w - t, y + p, t, len);
  }
}
