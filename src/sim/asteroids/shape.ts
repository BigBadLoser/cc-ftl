/**
 * Mask helpers for asteroid outlines: metaball blobs perturbed by noise, the largest 4-connected body, hole filling and a
 * distance-from-space transform. A mask is a Uint8Array of `w * h` cells, row-major, 1 = rock.
 */
import type { Rect } from '../grid';
import type { Rng } from '../rng';
import { fbm } from './noise';

export interface Mask {
  w: number;
  h: number;
  m: Uint8Array;
}

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** A metaball in mask cells: centre and radius. */
export interface Ball {
  x: number;
  y: number;
  r: number;
}

/**
 * Rock where the metaball field, roughened by noise, reaches 1: f = sum(r^2 / d^2) times (1 + rough * (noise - 0.5) * 2).
 * `freq` is the noise frequency in cycles per tile; `noiseSeed` keeps outlines independent of the rng stream.
 */
export function metaballs(w: number, h: number, balls: readonly Ball[], noiseSeed: number, rough: number, freq: number): Mask {
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let f = 0;
      for (const b of balls) {
        const dx = x + 0.5 - b.x;
        const dy = y + 0.5 - b.y;
        f += (b.r * b.r) / Math.max(0.25, dx * dx + dy * dy);
      }
      const n = fbm(noiseSeed, x, y, freq, 3);
      if (f * (1 + rough * (n - 0.5) * 2) >= 1) m[y * w + x] = 1;
    }
  }
  return { w, h, m };
}

/** Keep only the largest 4-connected body of the mask (ties: the first found in row-major order). */
export function largestBody(mask: Mask): void {
  const { w, h, m } = mask;
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || label[s]) continue;
    next++;
    let size = 0;
    const stack = [s];
    label[s] = next;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      size++;
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (m[j] && !label[j]) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  for (let i = 0; i < w * h; i++) if (m[i] && label[i] !== best) m[i] = 0;
}

/** Fill every empty cell the outside cannot reach (4-connected): a rock has no sealed bubbles of vacuum inside. */
export function fillHoles(mask: Mask): void {
  const { w, h, m } = mask;
  const out = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (!m[y * w + x]) stack.push(y * w + x);
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (!m[y * w + x]) stack.push(y * w + x);
  for (const i of stack) out[i] = 1;
  while (stack.length > 0) {
    const i = stack.pop() as number;
    const x = i % w;
    const y = (i - x) / w;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!m[j] && !out[j]) { out[j] = 1; stack.push(j); }
    }
  }
  for (let i = 0; i < w * h; i++) if (!m[i] && !out[i]) m[i] = 1;
}

/** 4-connected distance of every rock cell to the nearest empty cell or the mask edge (1 on the rim, 0 for empty). */
export function depth(mask: Mask): Int32Array {
  const { w, h, m } = mask;
  const d = new Int32Array(w * h).fill(-1);
  let frontier: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!m[i]) { d[i] = 0; continue; }
    const x = i % w;
    const y = (i - x) / w;
    const rim = N4.some(([dx, dy]) => {
      const nx = x + dx, ny = y + dy;
      return nx < 0 || ny < 0 || nx >= w || ny >= h || !m[ny * w + nx];
    });
    if (rim) { d[i] = 1; frontier.push(i); }
  }
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const i of frontier) {
      const x = i % w;
      const y = (i - x) / w;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (d[j] === -1) { d[j] = (d[i] as number) + 1; next.push(j); }
      }
    }
    frontier = next;
  }
  return d;
}

/** Bounding box of the set cells, or null for an empty mask. */
export function bounds(mask: Mask): Rect | null {
  let x0 = mask.w, y0 = mask.h, x1 = -1, y1 = -1;
  for (let y = 0; y < mask.h; y++) {
    for (let x = 0; x < mask.w; x++) {
      if (!mask.m[y * mask.w + x]) continue;
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** The cells of `r` cut out of the mask as a new mask. */
export function crop(mask: Mask, r: Rect): Mask {
  const m = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) m[y * r.w + x] = mask.m[(r.y + y) * mask.w + r.x + x] as number;
  return { w: r.w, h: r.h, m };
}

/** A blob of `count` metaballs scattered around the centre of a `w x h` box, kept to one solid body. */
export function blob(rng: Rng, w: number, h: number, count: number, rough: number): Mask {
  const cx = w / 2, cy = h / 2;
  const base = Math.min(w, h);
  const balls: Ball[] = [{ x: cx, y: cy, r: base * (0.2 + 0.06 * rng.next()) }];
  for (let i = 1; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.next() * 0.28;
    balls.push({ x: cx + Math.cos(a) * d * w, y: cy + Math.sin(a) * d * h, r: base * (0.08 + 0.12 * rng.next()) });
  }
  const mask = metaballs(w, h, balls, rng.int(0, 0x7fffffff), rough, Math.min(0.5, 6 / base));
  largestBody(mask);
  fillHoles(mask);
  return mask;
}
