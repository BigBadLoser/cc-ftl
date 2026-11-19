/**
 * The grid pane's drawing: the labelled view (tools/shipgen/labels.ts: its colours, room names, two-letter codes and lamp dots)
 * on a 2D canvas, drawn from the shared view so it pans and zooms with the preview. Pure drawing: it reads a design and a view.
 */
import type { RGB } from '../shipgen/draw';
import { DARK, DOOR, HALL, INK, LAMP, NAMES, WALL, roleTint } from '../shipgen/labels';
import { scaleOf, type Box, type View } from './camera';
import type { Design } from './design';
import { groundRect } from './ground';
import type { Rect } from './layout';

export interface Layers { ground: boolean; rooms: boolean; names: boolean; furniture: boolean; lamps: boolean; gridLines: boolean; shields: boolean; roof: boolean }
export const DEFAULT_LAYERS: Layers = { ground: true, rooms: true, names: true, furniture: true, lamps: true, gridLines: false, shields: false, roof: false };
export const LAYER_LABELS: Record<keyof Layers, string> = { ground: 'Asteroid ground', rooms: 'Rooms', names: 'Room names', furniture: 'Furniture codes', lamps: 'Lamps', gridLines: 'Tile grid', shields: 'Shields (preview)', roof: 'Roof (preview)' };
export interface Mark { tiles: readonly [number, number][]; color: string; /** false: an outline only. */ fill?: boolean; /** 'square': a dashed square in each tile (where crew stand). */ shape?: 'square' }
/** The side of a module that must sit on the hull: its tiles along that side and the step pointing out of the ship. */
export interface HullEdge { tiles: readonly [number, number][]; out: readonly [number, number]; color: string }

const css = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const BG = '#0a0c10';
const BEAM: RGB = [90, 96, 108];
/** Asteroid ground: a shade off the background with a touch of the rock's sand, so it reads as the site without competing with what stands on it. */
const GROUND = '#18160f';
const GROUND_SPECK = 'rgba(220,190,140,0.09)';
const HATCH = 'rgba(170,178,192,0.75)';

let hatchPattern: CanvasPattern | null = null;
/** The beam hatch: light diagonal strokes (45 degrees, a 6 px period) on clear, over the beam's base colour. */
function hatch(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (hatchPattern) return hatchPattern;
  const c = document.createElement('canvas');
  c.width = c.height = 6;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.strokeStyle = HATCH;
  g.lineWidth = 1.5;
  g.beginPath();
  for (const k of [-6, 0, 6]) { g.moveTo(k, 6); g.lineTo(k + 6, 0); }
  g.stroke();
  hatchPattern = ctx.createPattern(c, 'repeat') as CanvasPattern;
  return hatchPattern;
}
/**
 * Positions in device pixels, snapped: a tile edge (in tiles) to the whole device pixel it falls on, so every tile, line and border
 * is drawn on pixel boundaries and looks the same at every zoom and display scale (`k` device px per css px).
 */
interface Snap { X: (x: number) => number; Y: (y: number) => number; k: number; ox: number; oy: number; s: number }

/**
 * Draw one frame into `ctx`, which is set up in css px (any scale and translation: the grid pane's, a side-by-side half's). The drawing
 * itself runs in device pixels, every edge snapped (`Snap`), so lines and borders stay one crisp width; only the hull edge and its arrow,
 * drawn last, keep the css transform.
 */
export function drawGrid(ctx: CanvasRenderingContext2D, d: Design, v: View, dpr: number, box: Box, layers: Layers, marks: readonly Mark[], edges: readonly HullEdge[] = []): void {
  const s = scaleOf(v.zoom, dpr);
  const ox = box.w / 2 - (v.cx + 0.5) * s, oy = box.h / 2 - (v.cy + 0.5) * s;
  const t = ctx.getTransform(), k = t.a;
  const n: Snap = { X: (x) => Math.round(t.e + k * (ox + x * s)), Y: (y) => Math.round(t.f + k * (oy + y * s)), k, ox, oy, s };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bx = Math.round(t.e), by = Math.round(t.f), bw = Math.round(box.w * k), bh = Math.round(box.h * k);
  ctx.fillStyle = BG;
  ctx.fillRect(bx, by, bw, bh);
  const x0 = Math.max(0, Math.floor(-ox / s)), x1 = Math.min(d.width, Math.ceil((box.w - ox) / s));
  const y0 = Math.max(0, Math.floor(-oy / s)), y1 = Math.min(d.height, Math.ceil((box.h - oy) / s));
  const ex: number[] = [], ey: number[] = [];
  for (let x = x0; x <= x1; x++) ex[x] = n.X(x);
  for (let y = y0; y <= y1; y++) ey[y] = n.Y(y);
  const gr = layers.ground ? groundRect(d.layout) : null;
  if (gr) drawGround(ctx, gr, n);
  const tint = (x: number, y: number, c: string): RGB => (c === '#' ? WALL : c === 'D' ? DOOR : c === '=' ? BEAM : layers.rooms ? roleTint(d.rooms[d.roomOf[y * d.width + x] ?? -1]?.role ?? 'hall') : HALL);
  for (let y = y0; y < y1; y++) {
    const row = d.rows[y] ?? '';
    const top = ey[y] as number, h = (ey[y + 1] as number) - top;
    // a run of tiles of one colour is one rectangle between snapped edges: no seams, no overlaps
    for (let x = x0; x < x1;) {
      const c = row[x] ?? '.';
      if (c === '.') { x++; continue; }
      const color = css(tint(x, y, c));
      let e = x + 1;
      while (e < x1 && (row[e] ?? '.') !== '.' && css(tint(e, y, row[e] as string)) === color) e++;
      ctx.fillStyle = color;
      ctx.fillRect(ex[x] as number, top, (ex[e] as number) - (ex[x] as number), h);
      x = e;
    }
    if (s < 6) continue;
    for (let x = x0; x < x1; x++) {
      if (row[x] !== '=') continue;
      // a beam is hatched, so it reads apart from a wall; the pattern is laid in css px from the tile's corner, so it does not swim when panning
      ctx.save();
      ctx.beginPath();
      ctx.rect(ex[x] as number, top, (ex[x + 1] as number) - (ex[x] as number), h);
      ctx.clip();
      ctx.translate(ex[x] as number, top);
      ctx.scale(k, k);
      ctx.fillStyle = hatch(ctx);
      ctx.fillRect(0, 0, s + 1, s + 1);
      ctx.restore();
    }
  }
  if (layers.gridLines && s >= 8) {
    // one device pixel on each tile edge
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    const top = ey[y0] as number, bottom = ey[y1] as number, left = ex[x0] as number, right = ex[x1] as number;
    for (let x = x0; x <= x1; x++) ctx.fillRect(ex[x] as number, top, 1, bottom - top);
    for (let y = y0; y <= y1; y++) ctx.fillRect(left, ey[y] as number, right - left, 1);
  }
  const line = Math.max(1, Math.round(k));
  for (const m of d.modules) {
    if (m.lamp) {
      if (!layers.lamps) continue;
      const [tx, ty] = m.tiles[0] as [number, number];
      ctx.fillStyle = css(LAMP);
      ctx.beginPath();
      ctx.arc((n.X(tx) + n.X(tx + 1)) / 2, (n.Y(ty) + n.Y(ty + 1)) / 2, Math.max(1.5, s * 0.12) * k, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (!layers.furniture) continue;
    const xs = m.tiles.map((q) => q[0]), ys = m.tiles.map((q) => q[1]);
    const mx = Math.min(...xs), my = Math.min(...ys);
    // inset a pixel (css) from the footprint, then a one-pixel border inside that
    const L = n.X(mx) + line, T = n.Y(my) + line, R = n.X(mx + m.w) - line, B = n.Y(my + m.h) - line;
    if (L > bx + bw || T > by + bh || R < bx || B < by || R - L < 2 || B - T < 2) continue;
    ctx.fillStyle = css(DARK);
    ctx.fillRect(L, T, R - L, B - T);
    frame(ctx, L, T, R, B, line, css(INK));
    if (s >= 9) {
      ctx.fillStyle = css(INK);
      ctx.font = `600 ${Math.min(s * 0.5, 22) * k}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.code, (L + R) / 2, (T + B) / 2);
    }
  }
  if (layers.names && s >= 5) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(9, Math.min(s * 0.62, 20)) * k}px ui-monospace, monospace`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3 * k;
    for (const r of d.rooms) {
      if (!r.name || r.tiles < 10) continue;
      const px = t.e + k * (ox + (r.lx + 0.5) * s), py = t.f + k * (oy + (r.ly + 0.5) * s);
      if (px < bx - 80 * k || py < by - 20 * k || px > bx + bw + 80 * k || py > by + bh + 20 * k) continue;
      ctx.strokeStyle = '#000';
      ctx.strokeText(r.name, px, py);
      ctx.fillStyle = '#fff';
      ctx.fillText(r.name, px, py);
    }
  }
  for (const m of marks) (m.shape === 'square' ? squares : outline)(ctx, m, d, n);
  ctx.restore();
  for (const e of edges) hullEdge(ctx, e, ox, oy, s);
}

/** A rectangle's border, `w` device px wide, inside (L, T, R, B): four filled strips, so it is the same width on every side at any position. */
function frame(ctx: CanvasRenderingContext2D, L: number, T: number, R: number, B: number, w: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(L, T, R - L, w);
  ctx.fillRect(L, B - w, R - L, w);
  ctx.fillRect(L, T + w, w, B - T - 2 * w);
  ctx.fillRect(R - w, T + w, w, B - T - 2 * w);
}

/** The levelled ground a base stands on: a flat shade with a sparse speck per tile (fixed per tile, so it does not swim when panning). */
function drawGround(ctx: CanvasRenderingContext2D, r: Rect, n: Snap): void {
  ctx.fillStyle = GROUND;
  ctx.fillRect(n.X(r.x), n.Y(r.y), n.X(r.x + r.w) - n.X(r.x), n.Y(r.y + r.h) - n.Y(r.y));
  if (n.s < 8) return;
  ctx.fillStyle = GROUND_SPECK;
  const d = Math.max(1, Math.round(n.s * 0.08 * n.k));
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
    ctx.fillRect(n.X(x + ((h & 7) + 1) / 9), n.Y(y + (((h >> 3) & 7) + 1) / 9), d, d);
  }
}

/** A dashed square outline filling each tile, with a faint fill (where crew stand). */
function squares(ctx: CanvasRenderingContext2D, m: Mark, _d: Design, n: Snap): void {
  const w = Math.max(1, Math.round(2 * n.k)), i = Math.max(1, Math.round(n.k));
  ctx.strokeStyle = m.color;
  ctx.fillStyle = m.color.replace(/[\d.]+\)$/, '0.15)');
  ctx.lineWidth = w;
  ctx.setLineDash([Math.max(3, n.s * 0.18) * n.k, Math.max(2, n.s * 0.12) * n.k]);
  for (const [x, y] of m.tiles) {
    const L = n.X(x), T = n.Y(y), R = n.X(x + 1), B = n.Y(y + 1);
    ctx.fillRect(L, T, R - L, B - T);
    ctx.strokeRect(L + i + w / 2, T + i + w / 2, R - L - 2 * i - w, B - T - 2 * i - w);
  }
  ctx.setLineDash([]);
}

/** The hull side of a module: a thick line along the outer edge of its hull tiles and an arrow pointing out of the ship. */
function hullEdge(ctx: CanvasRenderingContext2D, e: HullEdge, ox: number, oy: number, s: number): void {
  if (e.tiles.length === 0) return;
  const [dx, dy] = e.out;
  const pts = e.tiles.map(([x, y]) => [ox + (x + 0.5 + dx * 0.5) * s, oy + (y + 0.5 + dy * 0.5) * s] as const);
  const sx = Math.abs(dy) * 0.5 * s, sy = Math.abs(dx) * 0.5 * s; // the edge runs along the side, half a tile either way
  const first = pts[0] as readonly [number, number], last = pts[pts.length - 1] as readonly [number, number];
  const mx = (first[0] + last[0]) / 2, my = (first[1] + last[1]) / 2;
  ctx.strokeStyle = e.color;
  ctx.fillStyle = e.color;
  ctx.lineWidth = Math.max(3, s * 0.18);
  ctx.beginPath();
  ctx.moveTo(first[0] - sx, first[1] - sy);
  ctx.lineTo(last[0] + sx, last[1] + sy);
  ctx.stroke();
  // arrowhead on the outer side, centred on the edge
  const a = Math.max(5, s * 0.55);
  ctx.beginPath();
  ctx.moveTo(mx + dx * a, my + dy * a);
  ctx.lineTo(mx - dy * a * 0.6, my + dx * a * 0.6);
  ctx.lineTo(mx + dy * a * 0.6, my - dx * a * 0.6);
  ctx.closePath();
  ctx.fill();
}

/** The outer edge of a set of tiles, drawn over the view (with a faint fill): a border two css px wide, inside the set, on snapped edges. */
function outline(ctx: CanvasRenderingContext2D, m: Mark, d: Design, n: Snap): void {
  if (m.tiles.length === 0) return;
  const inSet = new Set(m.tiles.map(([x, y]) => y * d.width + x));
  const w = Math.max(1, Math.round(2 * n.k));
  const fill = m.color.replace(/[\d.]+\)$/, '0.22)');
  for (const [x, y] of m.tiles) {
    const L = n.X(x), T = n.Y(y), R = n.X(x + 1), B = n.Y(y + 1);
    if (m.fill !== false) { ctx.fillStyle = fill; ctx.fillRect(L, T, R - L, B - T); }
    const has = (dx: number, dy: number): boolean => inSet.has((y + dy) * d.width + x + dx);
    ctx.fillStyle = m.color;
    if (!has(0, -1)) ctx.fillRect(L, T, R - L, w);
    if (!has(0, 1)) ctx.fillRect(L, B - w, R - L, w);
    if (!has(-1, 0)) ctx.fillRect(L, T, w, B - T);
    if (!has(1, 0)) ctx.fillRect(R - w, T, w, B - T);
  }
}

export interface KeyRoom { role: string; name: string; color: string }
export interface KeyExtra { name: string; color: string; dot?: boolean; hatch?: boolean }
/**
 * The room types in use (for the palette's list) and what else the grid draws that no list covers (wall, door, beam, lamps).
 * Furniture codes are the palette's module list.
 */
export function keyOf(d: Design): { rooms: KeyRoom[]; extras: KeyExtra[] } {
  const roles = [...new Set(d.rooms.filter((r) => r.tiles > 0).map((r) => r.role))].filter((r) => r !== 'hall').sort();
  const rooms = roles.map((role) => ({ role, name: NAMES[role] ?? role, color: css(roleTint(role)) }));
  rooms.push({ role: 'hall', name: 'corridor', color: css(HALL) });
  const extras: KeyExtra[] = [{ name: 'wall / hull', color: css(WALL) }, { name: 'door', color: css(DOOR) }];
  if (d.layout.ground) extras.push({ name: 'asteroid ground', color: GROUND });
  if (d.rows.some((r) => r.includes('='))) extras.push({ name: 'beam', color: css(BEAM), hatch: true });
  if (d.modules.some((m) => m.lamp)) extras.push({ name: 'lamp', color: css(DARK), dot: true });
  return { rooms, extras };
}
