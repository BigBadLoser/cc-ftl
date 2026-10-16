import type { Grid } from './grid';
import { Struct, gasConductance } from './structure';

/** Per-tile gas conductance (0 walls / closed doors, 1 floor and space, fraction for doors). */
export function conductanceMap(grid: Grid): Float64Array {
  const struct = grid.raw('struct');
  const door = grid.raw('door');
  const out = new Float64Array(struct.length);
  for (let i = 0; i < out.length; i++) out[i] = gasConductance(struct[i] as number, door[i] as number);
  return out;
}

/** Load a grid field into a Float64 scratch array. */
export function loadField(grid: Grid, field: string): Float64Array {
  return Float64Array.from(grid.raw(field));
}

/**
 * One explicit, mass-conserving diffusion step over 4-neighbour links, for several fields at once.
 * Each link moves k * (a - b) from the richer tile to the poorer one, with
 * k = (kNormal, or kVent if either end is Space) * min(conductance). Space tiles never change
 * (they are a fixed sink/source). Stable while a tile's links sum to <= 1.
 */
export function diffuseStep(
  grid: Grid, cond: Float64Array, fields: Float64Array[], kNormal: number, kVent: number, floorAtZero: boolean,
): void {
  const { width, height } = grid;
  const struct = grid.raw('struct');
  const delta = fields.map(() => new Float64Array(struct.length));
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
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x < width - 1) link(i, i + 1);
      if (y < height - 1) link(i, i + width);
    }
  }
  for (let f = 0; f < fields.length; f++) {
    const v = fields[f] as Float64Array;
    const dl = delta[f] as Float64Array;
    for (let i = 0; i < v.length; i++) {
      if (dl[i] === 0) continue;
      const next = (v[i] as number) + (dl[i] as number);
      v[i] = floorAtZero && next < 0 ? 0 : next;
    }
  }
}

/** Write a scratch array back to a grid field, skipping changes smaller than `eps`. */
export function writeBack(grid: Grid, field: string, vals: Float64Array, eps: number, round = false): void {
  const raw = grid.raw(field);
  const { width } = grid;
  for (let i = 0; i < vals.length; i++) {
    const v = round ? Math.min(255, Math.max(0, Math.round(vals[i] as number))) : (vals[i] as number);
    if (Math.abs(v - (raw[i] as number)) > eps) {
      const x = i % width;
      grid.set(field, x, (i - x) / width, v);
    }
  }
}
