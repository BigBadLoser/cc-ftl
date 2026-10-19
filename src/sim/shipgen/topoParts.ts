import type { Builder, Part, Rect } from './builder';
import type { RoomSpec } from './plan';

/** Shared structural pieces: struts (thin corridors), junctions, pods hung off a part. */

/** A one-tile-wide corridor running east from `from`'s east wall at interior row `row`, `len` tiles long. */
export function strutE(b: Builder, from: Rect, row: number, len: number): Part | null {
  const s = b.place({ x: from.x + from.w - 1, y: row - 1, w: len + 2, h: 3 }, 'hall');
  if (s) b.door(from, s);
  return s;
}

/** A one-tile-wide corridor running north ('n') or south ('s') from `from` at interior column `col`. */
export function strutV(b: Builder, from: Rect, side: 'n' | 's', col: number, len: number): Part | null {
  const r: Rect = side === 'n' ? { x: col - 1, y: from.y - len - 1, w: 3, h: len + 2 } : { x: col - 1, y: from.y + from.h - 1, w: 3, h: len + 2 };
  const s = b.place(r, 'hall');
  if (s) b.door(from, s);
  return s;
}

/** A one-tile-wide corridor running west from `from`'s west wall at interior row `row`. */
export function strutW(b: Builder, from: Rect, row: number, len: number): Part | null {
  const s = b.place({ x: from.x - len - 1, y: row - 1, w: len + 2, h: 3 }, 'hall');
  if (s) b.door(from, s);
  return s;
}

/** Outer length of rooms side by side sharing walls. */
export const runLen = (specs: RoomSpec[], gap = 0): number => specs.reduce((t, s) => t + s.w + 1 + gap, 1) - gap;

/** Interior row of a horizontal one-wide corridor part. */
export const rowOf = (p: Rect): number => p.y + 1;
export const colOf = (p: Rect): number => p.x + 1;

/** Pods stacked on the east side of a vertical part (engines face open space there). Returns the parts placed. */
export function eastStack(b: Builder, p: Rect, specs: RoomSpec[], top: number): Part[] {
  const out: Part[] = [];
  let y = top;
  for (const s of specs) {
    const part = b.place({ x: p.x + p.w - 1, y, w: s.w + 2, h: s.h + 2 }, s.role, s);
    if (part) { b.door(p, part); out.push(part); }
    y += s.h + 1;
  }
  return out;
}

/** Outer height of rooms stacked sharing walls. */
export const stackLen = (specs: RoomSpec[]): number => specs.reduce((t, s) => t + s.h + 1, 1);
