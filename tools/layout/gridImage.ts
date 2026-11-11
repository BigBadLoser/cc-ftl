/** The grid as a small PNG (a data URL), for the case export: a fixed modest scale, the same frame for every image of a case. */
import { TILE_H } from '../../src/render/iso';
import { diffMarks, drawMoves } from './diffDraw';
import type { Diff } from './diff';
import type { Design } from './design';
import { DEFAULT_LAYERS, drawGrid } from './gridDraw';
import { contentBounds, type Layout } from './layout';

export interface Frame { x0: number; y0: number; x1: number; y1: number }
/** The tiles both layouts occupy, with a margin: every image of a case is cut to this one frame. */
export function frameOf(a: Layout, b: Layout, margin = 2): Frame | null {
  const fa = contentBounds(a), fb = contentBounds(b);
  const f = fa && fb ? { x0: Math.min(fa.x0, fb.x0), y0: Math.min(fa.y0, fb.y0), x1: Math.max(fa.x1, fb.x1), y1: Math.max(fa.y1, fb.y1) } : fa ?? fb;
  return f ? { x0: f.x0 - margin, y0: f.y0 - margin, x1: f.x1 + margin, y1: f.y1 + margin } : null;
}
/** Pixels a tile spans: 12, or less so the image stays at most ~1600 px wide (never below 6). */
export const pxPerTile = (f: Frame): number => Math.max(6, Math.min(12, Math.floor(1600 / (f.x1 - f.x0 + 1))));

export function gridPng(d: Design, frame: Frame, diff: Diff | null): string {
  const s = pxPerTile(frame);
  const box = { w: (frame.x1 - frame.x0 + 1) * s, h: (frame.y1 - frame.y0 + 1) * s };
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const view = { cx: (frame.x0 + frame.x1) / 2, cy: (frame.y0 + frame.y1) / 2, zoom: s / TILE_H };
  drawGrid(ctx, d, view, 1, box, DEFAULT_LAYERS, diff ? diffMarks(d, diff) : []);
  if (diff) drawMoves(ctx, diff, view, 1, box);
  return c.toDataURL('image/png');
}
