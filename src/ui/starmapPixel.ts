/**
 * The starmap's pixel look: lines and outlines drawn as pixel cells on a grid of `g` map units (two screen pixels at the current zoom, so a cell
 * stays the size of the game's art pixels however far the map is zoomed), and shapes built from squares. Lines are Bresenham lines: the cells
 * of a line, merged into one rectangle per run along its major axis, so a straight lane has evenly spaced steps and no elbows. Everything is a
 * filled path (the view fills it, crisp-edged). Outlines are cached by path and grid.
 */

/** Lines longer than this many cells are drawn as a plain band (a lane far off-screen at a deep zoom). */
const MAX_CELLS = 3000;

const f = (v: number): string => (Math.round(v * 100) / 100).toString();

/** Line options: `w` its thickness in cells; `dash` [on, off] in cells along it (omitted: solid). */
export interface PixelLineOpts {
  w?: number;
  dash?: readonly [number, number];
}

/** A rectangle of cells, columns i0..i1 and rows j0..j1 (inclusive, cell indices), as a path. */
const cellRect = (i0: number, i1: number, j0: number, j1: number, g: number): string =>
  `M${f((i0 - 0.5) * g)} ${f((j0 - 0.5) * g)}h${f((i1 - i0 + 1) * g)}v${f((j1 - j0 + 1) * g)}h${f(-(i1 - i0 + 1) * g)}Z`;

/** The cells of the Bresenham line from cell (x0, y0) to (x1, y1), as runs along the major axis, thickened to `w` cells and dashed. */
function cells(x0: number, y0: number, x1: number, y1: number, g: number, o: PixelLineOpts): string {
  const w = Math.max(1, o.w ?? 1);
  const lo = -Math.floor((w - 1) / 2);
  const hi = lo + w - 1;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x1 >= x0 ? 1 : -1;
  const sy = y1 >= y0 ? 1 : -1;
  const xMajor = dx >= dy;
  const on = (k: number): boolean => !o.dash || k % (o.dash[0] + o.dash[1]) < o.dash[0];
  let d = '';
  // A run: cells from `a` to `b` along the major axis at minor coordinate `m`.
  const emit = (a: number, b: number, m: number) => {
    const [p, q] = a <= b ? [a, b] : [b, a];
    d += xMajor ? cellRect(p, q, m + lo, m + hi, g) : cellRect(m + lo, m + hi, p, q, g);
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
  return d;
}

/** A plain band of `w` cells from (ax, ay) to (bx, by): the fallback for lines too long to draw cell by cell. */
function band(ax: number, ay: number, bx: number, by: number, g: number, w: number): string {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * (w * g) / 2;
  const ny = ((bx - ax) / len) * (w * g) / 2;
  return `M${f(ax + nx)} ${f(ay + ny)}L${f(bx + nx)} ${f(by + ny)}L${f(bx - nx)} ${f(by - ny)}L${f(ax - nx)} ${f(ay - ny)}Z`;
}

/** A lane (or any segment) as a pixel line. */
export function pixelLine(ax: number, ay: number, bx: number, by: number, g: number, o: PixelLineOpts = {}): string {
  const [x0, y0, x1, y1] = [ax, ay, bx, by].map((v) => Math.round(v / g)) as [number, number, number, number];
  if (Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) > MAX_CELLS) return band(ax, ay, bx, by, g, o.w ?? 1);
  return cells(x0, y0, x1, y1, g, o);
}

/** A polyline ("x,y x,y ...", as the route is given) as one pixel path. */
export function pixelPolyline(points: string, g: number, o: PixelLineOpts = {}): string {
  const pts = points.trim().split(/\s+/).map((p) => p.split(',').map(Number)).filter((p) => p.length === 2 && p.every(Number.isFinite));
  let d = '';
  for (let i = 1; i < pts.length; i++) d += pixelLine(pts[i - 1]![0]!, pts[i - 1]![1]!, pts[i]![0]!, pts[i]![1]!, g, o);
  return d;
}

const outlines = new Map<string, string>();

/** The border of a closed outline made of M/L/Z loops (starmapShapes.ts `fluidOutline`) as pixel lines, `w` cells thick. Cached. */
export function pixelOutline(d: string, g: number, w = 1): string {
  const key = `${g.toFixed(4)}|${w}|${d}`;
  const hit = outlines.get(key);
  if (hit !== undefined) return hit;
  let out = '';
  for (const loop of d.split(/Z/i)) {
    const nums = loop.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (nums.length < 6) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i % pts.length]!;
      out += pixelLine(a[0], a[1], b[0], b[1], g, { w });
    }
  }
  if (outlines.size > 600) outlines.clear();
  outlines.set(key, out);
  return out;
}

/** A square of 2h + 1 cells around the cell of (x, y), h = `r` in cells: on the same cells the lines are drawn on. */
export function pixelSquare(x: number, y: number, r: number, g: number): { x: number; y: number; width: number; height: number } {
  const h = Math.max(0, Math.round(r / g));
  const size = (2 * h + 1) * g;
  return { x: (Math.round(x / g) - h - 0.5) * g, y: (Math.round(y / g) - h - 0.5) * g, width: size, height: size };
}

/** A filled diamond (a square on its corner) of half-size `r` around (x, y), in pixel cells. */
export function pixelDiamond(x: number, y: number, r: number, g: number): string {
  const ci = Math.round(x / g);
  const cj = Math.round(y / g);
  const h = Math.max(1, Math.round(r / g));
  let d = '';
  for (let j = -h; j <= h; j++) {
    const half = h - Math.abs(j);
    d += cellRect(ci - half, ci + half, cj + j, cj + j, g);
  }
  return d;
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
 * An arrowhead (a fleet, the player's ship) rasterised into pixel cells of `g` at a heading snapped to 45°, centred on the origin: the cells whose
 * centres fall inside the rotated outline, merged into one rect per run. `scale` stretches the outline (in cells).
 */
export function pixelArrow(deg: number, g: number, scale = 1): string {
  const a = ((Math.round(deg / 45) * 45) * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const poly = ARROW.map(([x, y]): [number, number] => [(x * c - y * sn) * scale, (x * sn + y * c) * scale]);
  const r = Math.ceil(4 * scale);
  let d = '';
  for (let j = -r; j <= r; j++) {
    let run: number | null = null;
    for (let i = -r; i <= r + 1; i++) {
      const on = i <= r && inside(poly, i, j);
      if (on && run === null) run = i;
      if (!on && run !== null) {
        d += `M${f((run - 0.5) * g)} ${f((j - 0.5) * g)}h${f((i - run) * g)}v${f(g)}h${f(-(i - run) * g)}Z`;
        run = null;
      }
    }
  }
  return d;
}
