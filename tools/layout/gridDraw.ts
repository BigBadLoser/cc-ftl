/**
 * The grid pane's drawing: the labelled view (tools/shipgen/labels.ts: its colours, room names, two-letter codes and lamp dots)
 * on a 2D canvas, drawn from the shared view so it pans and zooms with the preview. Pure drawing: it reads a design and a view.
 */
import type { RGB } from '../shipgen/draw';
import { DARK, DOOR, HALL, INK, LAMP, NAMES, WALL, roleTint } from '../shipgen/labels';
import { scaleOf, type Box, type View } from './camera';
import type { Design } from './design';

export interface Layers { rooms: boolean; names: boolean; furniture: boolean; lamps: boolean; gridLines: boolean; shields: boolean }
export const DEFAULT_LAYERS: Layers = { rooms: true, names: true, furniture: true, lamps: true, gridLines: false, shields: false };
export const LAYER_LABELS: Record<keyof Layers, string> = { rooms: 'Rooms', names: 'Room names', furniture: 'Furniture codes', lamps: 'Lamps', gridLines: 'Tile grid', shields: 'Shields (preview)' };
export interface Mark { tiles: readonly [number, number][]; color: string }

const css = (c: RGB, a = 1): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const BG = '#0a0c10';
const BEAM: RGB = [90, 96, 108];

/** Draw one frame into `ctx` (already scaled to css px). */
export function drawGrid(ctx: CanvasRenderingContext2D, d: Design, v: View, dpr: number, box: Box, layers: Layers, marks: readonly Mark[]): void {
  const s = scaleOf(v.zoom, dpr);
  const ox = box.w / 2 - (v.cx + 0.5) * s, oy = box.h / 2 - (v.cy + 0.5) * s;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, box.w, box.h);
  const x0 = Math.max(0, Math.floor(-ox / s)), x1 = Math.min(d.width, Math.ceil((box.w - ox) / s));
  const y0 = Math.max(0, Math.floor(-oy / s)), y1 = Math.min(d.height, Math.ceil((box.h - oy) / s));
  const pad = s >= 6 ? 0 : -0.25; // a hairline overlap at small scales hides seams
  for (let y = y0; y < y1; y++) {
    const row = d.rows[y] ?? '';
    for (let x = x0; x < x1; x++) {
      const c = row[x] ?? '.';
      if (c === '.') continue;
      const color: RGB = c === '#' ? WALL : c === 'D' ? DOOR : c === '=' ? BEAM : layers.rooms ? roleTint(d.rooms[d.roomOf[y * d.width + x] ?? -1]?.role ?? 'hall') : HALL;
      ctx.fillStyle = css(color);
      ctx.fillRect(ox + x * s + pad, oy + y * s + pad, s - 2 * pad, s - 2 * pad);
    }
  }
  if (layers.gridLines && s >= 8) {
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x0; x <= x1; x++) { ctx.moveTo(Math.round(ox + x * s) + 0.5, oy + y0 * s); ctx.lineTo(Math.round(ox + x * s) + 0.5, oy + y1 * s); }
    for (let y = y0; y <= y1; y++) { ctx.moveTo(ox + x0 * s, Math.round(oy + y * s) + 0.5); ctx.lineTo(ox + x1 * s, Math.round(oy + y * s) + 0.5); }
    ctx.stroke();
  }
  for (const m of d.modules) {
    if (m.lamp) {
      if (!layers.lamps) continue;
      const [tx, ty] = m.tiles[0] as [number, number];
      ctx.fillStyle = css(LAMP);
      const r = Math.max(1.5, s * 0.12);
      ctx.beginPath();
      ctx.arc(ox + (tx + 0.5) * s, oy + (ty + 0.5) * s, r, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (!layers.furniture) continue;
    const xs = m.tiles.map((t) => t[0]), ys = m.tiles.map((t) => t[1]);
    const mx = ox + Math.min(...xs) * s + 1, my = oy + Math.min(...ys) * s + 1, mw = m.w * s - 2, mh = m.h * s - 2;
    if (mx > box.w || my > box.h || mx + mw < 0 || my + mh < 0) continue;
    ctx.fillStyle = css(DARK);
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = css(INK);
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + 0.5, my + 0.5, mw - 1, mh - 1);
    if (s >= 9) {
      ctx.fillStyle = css(INK);
      ctx.font = `600 ${Math.min(s * 0.5, 22)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.code, mx + mw / 2, my + mh / 2);
    }
  }
  if (layers.names && s >= 5) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.max(9, Math.min(s * 0.62, 20))}px ui-monospace, monospace`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    for (const r of d.rooms) {
      if (!r.name || r.tiles < 10) continue;
      const px = ox + (r.lx + 0.5) * s, py = oy + (r.ly + 0.5) * s;
      if (px < -80 || py < -20 || px > box.w + 80 || py > box.h + 20) continue;
      ctx.strokeStyle = '#000';
      ctx.strokeText(r.name, px, py);
      ctx.fillStyle = '#fff';
      ctx.fillText(r.name, px, py);
    }
  }
  for (const m of marks) outline(ctx, m, d, ox, oy, s);
}

/** The outer edge of a set of tiles, drawn over the view (with a faint fill). */
function outline(ctx: CanvasRenderingContext2D, m: Mark, d: Design, ox: number, oy: number, s: number): void {
  if (m.tiles.length === 0) return;
  const inSet = new Set(m.tiles.map(([x, y]) => y * d.width + x));
  ctx.fillStyle = m.color.replace(/[\d.]+\)$/, '0.22)');
  ctx.strokeStyle = m.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [x, y] of m.tiles) {
    ctx.fillRect(ox + x * s, oy + y * s, s, s);
    const has = (dx: number, dy: number): boolean => inSet.has((y + dy) * d.width + x + dx);
    const l = ox + x * s, t = oy + y * s;
    if (!has(0, -1)) { ctx.moveTo(l, t); ctx.lineTo(l + s, t); }
    if (!has(0, 1)) { ctx.moveTo(l, t + s); ctx.lineTo(l + s, t + s); }
    if (!has(-1, 0)) { ctx.moveTo(l, t); ctx.lineTo(l, t + s); }
    if (!has(1, 0)) { ctx.moveTo(l + s, t); ctx.lineTo(l + s, t + s); }
  }
  ctx.stroke();
}

export interface KeyRoom { role: string; name: string; color: string }
export interface KeyExtra { name: string; color: string; dot?: boolean }
/**
 * The room types in use (for the palette's list) and what else the grid draws that no list covers (wall, door, beam, lamps).
 * Furniture codes are the palette's module list.
 */
export function keyOf(d: Design): { rooms: KeyRoom[]; extras: KeyExtra[] } {
  const roles = [...new Set(d.rooms.map((r) => r.role))].filter((r) => r !== 'hall').sort();
  const rooms = roles.map((role) => ({ role, name: NAMES[role] ?? role, color: css(roleTint(role)) }));
  rooms.push({ role: 'hall', name: 'corridor', color: css(HALL) });
  const extras: KeyExtra[] = [{ name: 'wall / hull', color: css(WALL) }, { name: 'door', color: css(DOOR) }];
  if (d.rows.some((r) => r.includes('='))) extras.push({ name: 'beam', color: css(BEAM) });
  if (d.modules.some((m) => m.lamp)) extras.push({ name: 'lamp', color: css(DARK), dot: true });
  return { rooms, extras };
}
