import type { GridLike } from './grid';
import { Struct, gasConductance } from './structure';

/**
 * A region's structure as the field systems see it, rebuilt only when its `struct` revision changes. `active` lists the
 * tiles a gas link can touch: every non-Space tile plus each Space tile 4-adjacent to one. Space-to-Space links never
 * move anything, so diffusion over `active` gives exactly the result of a full sweep while vacuum inside the bbox
 * (open truss frames, the margin of a template) costs nothing.
 */
export interface FieldFrame {
  readonly width: number;
  readonly height: number;
  readonly rev: number;
  readonly struct: Float64Array;
  /** Ascending tile indices (y * width + x). */
  readonly active: Int32Array;
  /** Per-field delta scratch for diffuseStep, all zero between calls. */
  readonly scratch: Float64Array[];
}

const frames = new WeakMap<GridLike, FieldFrame>();

/** The cached frame of a grid (whole local rectangle). Read-only. */
export function fieldFrame(grid: GridLike): FieldFrame {
  const rev = grid.revision('struct');
  const hit = frames.get(grid);
  if (hit && hit.rev === rev && hit.width === grid.width && hit.height === grid.height) return hit;
  const { width, height } = grid;
  const struct = grid.load('struct');
  const list: number[] = [];
  for (let i = 0; i < struct.length; i++) {
    if (struct[i] !== Struct.Space) {
      list.push(i);
      continue;
    }
    const x = i % width;
    if (
      (x > 0 && struct[i - 1] !== Struct.Space) || (x < width - 1 && struct[i + 1] !== Struct.Space) ||
      (i >= width && struct[i - width] !== Struct.Space) || (i + width < struct.length && struct[i + width] !== Struct.Space)
    ) list.push(i);
  }
  const frame: FieldFrame = { width, height, rev, struct, active: Int32Array.from(list), scratch: [] };
  frames.set(grid, frame);
  return frame;
}

/** Per-tile gas conductance (0 walls / closed doors, 1 floor and space, fraction for doors), filled on active tiles only. */
export function conductanceMap(grid: GridLike, frame: FieldFrame): Float64Array {
  const door = grid.load('door');
  const out = new Float64Array(frame.struct.length);
  for (const i of frame.active) out[i] = gasConductance(frame.struct[i] as number, door[i] as number);
  return out;
}

/**
 * One explicit, mass-conserving diffusion step over 4-neighbour links, for several fields at once.
 * Each link moves k * (a - b) from the richer tile to the poorer one, with
 * k = (kNormal, or kVent if either end is Space) * min(conductance). Space tiles never change
 * (they are a fixed sink/source). Stable while a tile's links sum to <= 1. Links run in ascending tile order (right,
 * then down), the same order as a full row-major sweep, so the floating-point sums are identical.
 */
export function diffuseStep(
  frame: FieldFrame, cond: Float64Array, fields: Float64Array[], kNormal: number, kVent: number, floorAtZero: boolean,
): void {
  const { width, struct, active } = frame;
  const n = struct.length;
  while (frame.scratch.length < fields.length) frame.scratch.push(new Float64Array(n));
  const delta = frame.scratch;
  const link = (i: number, j: number): void => {
    const c = Math.min(cond[i] as number, cond[j] as number);
    if (c <= 0) return;
    const si = struct[i] === Struct.Space;
    const sj = struct[j] === Struct.Space;
    if (si && sj) return;
    const k = (si || sj ? kVent : kNormal) * c;
    for (let f = 0; f < fields.length; f++) {
      const v = fields[f] as Float64Array;
      const d = k * ((v[i] as number) - (v[j] as number));
      const dl = delta[f] as Float64Array;
      if (!si) dl[i] = (dl[i] as number) - d;
      if (!sj) dl[j] = (dl[j] as number) + d;
    }
  };
  for (let a = 0; a < active.length; a++) {
    const i = active[a] as number;
    if (i % width < width - 1) link(i, i + 1);
    if (i + width < n) link(i, i + width);
  }
  for (let f = 0; f < fields.length; f++) {
    const v = fields[f] as Float64Array;
    const dl = delta[f] as Float64Array;
    for (let a = 0; a < active.length; a++) {
      const i = active[a] as number;
      if (dl[i] === 0) continue;
      const next = (v[i] as number) + (dl[i] as number);
      v[i] = floorAtZero && next < 0 ? 0 : next;
      dl[i] = 0;
    }
  }
}

/** Write a scratch array back to a grid field where it differs from `before` (the loaded values) by more than `eps`. */
export function writeBack(grid: GridLike, field: string, vals: Float64Array, before: Float64Array, eps: number, round = false): void {
  const { width } = grid;
  for (let i = 0; i < vals.length; i++) {
    const v = round ? Math.min(255, Math.max(0, Math.round(vals[i] as number))) : (vals[i] as number);
    if (Math.abs(v - (before[i] as number)) > eps) {
      const x = i % width;
      grid.set(field, x, (i - x) / width, v);
    }
  }
}
