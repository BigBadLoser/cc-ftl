/**
 * The starmap's pixel look: lines and outlines drawn as stair-steps on a grid of `g` map units (two screen pixels at the current zoom, so the
 * steps stay the size of the game's art pixels however far the map is zoomed), and shapes built from squares. Paths only; the view styles them
 * (crisp edges, square caps). Pure and cheap: a lane is at most MAX_STEPS steps, and stepped outlines are cached by path and grid.
 */

const MAX_STEPS = 400;

const snap = (v: number, g: number): number => Math.round(v / g) * g;
const f = (v: number): string => (Math.round(v * 100) / 100).toString();

/** The stair-step from (ax, ay) to (bx, by), after an `M` or a previous step: H and V moves only. */
function steps(ax: number, ay: number, bx: number, by: number, g: number): string {
  const n = Math.min(MAX_STEPS, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / g));
  let x = snap(ax, g);
  let y = snap(ay, g);
  let d = '';
  for (let i = 1; i <= n; i++) {
    const nx = snap(ax + ((bx - ax) * i) / n, g);
    const ny = snap(ay + ((by - ay) * i) / n, g);
    if (nx !== x) d += `H${f(nx)}`;
    if (ny !== y) d += `V${f(ny)}`;
    x = nx;
    y = ny;
  }
  return d;
}

/** A lane (or any segment) as a pixel line. */
export const pixelLine = (ax: number, ay: number, bx: number, by: number, g: number): string => `M${f(snap(ax, g))} ${f(snap(ay, g))}${steps(ax, ay, bx, by, g)}`;

/** A polyline ("x,y x,y ...", as the route is given) as one pixel path. */
export function pixelPolyline(points: string, g: number): string {
  const pts = points.trim().split(/\s+/).map((p) => p.split(',').map(Number) as [number, number]).filter((p) => p.length === 2 && p.every(Number.isFinite));
  if (pts.length < 2) return '';
  let d = `M${f(snap(pts[0]![0], g))} ${f(snap(pts[0]![1], g))}`;
  for (let i = 1; i < pts.length; i++) d += steps(pts[i - 1]![0], pts[i - 1]![1], pts[i]![0], pts[i]![1], g);
  return d;
}

const outlines = new Map<string, string>();

/** A closed outline made of M/L/Z loops (starmapShapes.ts `fluidOutline`) redrawn as pixel loops. Cached. */
export function pixelOutline(d: string, g: number): string {
  const key = `${g.toFixed(4)}|${d}`;
  const hit = outlines.get(key);
  if (hit !== undefined) return hit;
  let out = '';
  for (const loop of d.split(/Z/i)) {
    const nums = loop.match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (nums.length < 6) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i]!, nums[i + 1]!]);
    out += `M${f(snap(pts[0]![0], g))} ${f(snap(pts[0]![1], g))}`;
    for (let i = 1; i <= pts.length; i++) {
      const a = pts[i - 1]!;
      const b = pts[i % pts.length]!;
      out += steps(a[0], a[1], b[0], b[1], g);
    }
    out += 'Z';
  }
  if (outlines.size > 600) outlines.clear();
  outlines.set(key, out);
  return out;
}

/** A square of half-size `r` centred on (x, y), snapped to the grid. */
export function pixelSquare(x: number, y: number, r: number, g: number): { x: number; y: number; width: number; height: number } {
  const h = Math.max(g, snap(r, g));
  return { x: snap(x, g) - h, y: snap(y, g) - h, width: 2 * h, height: 2 * h };
}

/** A diamond (a square on its corner) of half-size `r`, drawn as pixel steps. */
export function pixelDiamond(x: number, y: number, r: number, g: number): string {
  const cx = snap(x, g);
  const cy = snap(y, g);
  const h = Math.max(g, snap(r, g));
  return `M${f(cx)} ${f(cy - h)}${steps(cx, cy - h, cx + h, cy, g)}${steps(cx + h, cy, cx, cy + h, g)}${steps(cx, cy + h, cx - h, cy, g)}${steps(cx - h, cy, cx, cy - h, g)}Z`;
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
