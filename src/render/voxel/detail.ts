import type { VoxelModel } from './model';
import { P } from './palette';
import type { Rand } from './rng';

/** Rectangle on a model; y range is the vertical extent, x/z the footprint. */
export interface Region {
  x0: number; y0: number; z0: number;
  x1: number; y1: number; z1: number;
}

/** Whole-model region. */
export function whole(m: VoxelModel): Region {
  return { x0: 0, y0: 0, z0: 0, x1: m.sx, y1: m.sy, z1: m.sz };
}

/** Only touch voxels that exist (non-empty): detail never adds geometry. */
function paint(m: VoxelModel, x: number, y: number, z: number, c: number): void {
  if (m.get(x, y, z)) m.set(x, y, z, c);
}

/** Darker seam lines on the four vertical faces every `spacing` voxels in height (rows) and width. */
export function panelSeams(m: VoxelModel, r: Region, spacing: number, color: number = P.steelD): void {
  for (let y = r.y0; y < r.y1; y++)
    for (let z = r.z0; z < r.z1; z++)
      for (let x = r.x0; x < r.x1; x++) {
        const edgeX = x === r.x0 || x === r.x1 - 1;
        const edgeZ = z === r.z0 || z === r.z1 - 1;
        const row = (y - r.y0) % spacing === spacing - 1;
        const col = ((edgeX ? z : x) - (edgeX ? r.z0 : r.x0)) % (spacing * 2) === 0;
        if ((edgeX || edgeZ) && (row || col)) paint(m, x, y, z, color);
      }
}

/** Rivets on the outer shell: single bolt voxels at a grid of positions along the top-most surface voxels of each column/row. */
export function rivets(m: VoxelModel, r: Region, y: number, step: number, color: number = P.bolt): void {
  for (let z = r.z0; z < r.z1; z++)
    for (let x = r.x0; x < r.x1; x++) {
      const edgeX = x === r.x0 || x === r.x1 - 1;
      const edgeZ = z === r.z0 || z === r.z1 - 1;
      if (!(edgeX || edgeZ)) continue;
      const along = edgeX ? z - r.z0 : x - r.x0;
      if (along % step === Math.floor(step / 2)) paint(m, x, y, z, color);
    }
}

/** Seeded speckle: replaces random existing voxels in a region, denser toward the bottom if `fade`. */
export function grime(
  m: VoxelModel, r: Region, rand: Rand, density: number, colors: readonly number[], fade = false,
): void {
  const h = Math.max(1, r.y1 - r.y0);
  for (let y = r.y0; y < r.y1; y++) {
    const k = fade ? 1 - (y - r.y0) / h : 1;
    for (let z = r.z0; z < r.z1; z++)
      for (let x = r.x0; x < r.x1; x++) {
        if (!m.get(x, y, z)) continue;
        if (rand() < density * k) paint(m, x, y, z, colors[Math.floor(rand() * colors.length)] as number);
      }
  }
}

/** Yellow/black diagonal stripes on the voxels of the shell within rows y0..y1. */
export function hazardStripes(m: VoxelModel, r: Region, width = 2): void {
  for (let y = r.y0; y < r.y1; y++)
    for (let z = r.z0; z < r.z1; z++)
      for (let x = r.x0; x < r.x1; x++) {
        const edgeX = x === r.x0 || x === r.x1 - 1;
        const edgeZ = z === r.z0 || z === r.z1 - 1;
        if (!(edgeX || edgeZ)) continue;
        const along = edgeX ? z : x;
        paint(m, x, y, z, Math.floor((along + y) / width) % 2 ? P.hazK : P.hazY);
      }
}

/** Horizontal hazard stripes on the top face (y = r.y1 - 1) of a region. */
export function hazardTop(m: VoxelModel, r: Region, width = 2): void {
  for (let z = r.z0; z < r.z1; z++)
    for (let x = r.x0; x < r.x1; x++)
      paint(m, x, r.y1 - 1, z, Math.floor((x + z) / width) % 2 ? P.hazK : P.hazY);
}

/** A grille: parallel dark slots inset on the +z face of a box (slot rows along x). */
export function grille(m: VoxelModel, x0: number, y0: number, x1: number, y1: number, z: number): void {
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x++) paint(m, x, y, z, P.dark);
}

/** Vent: framed grille on a face plane. `axis` picks the face: 'z' = a +z face, 'x' = a +x face. */
export function vent(m: VoxelModel, axis: 'x' | 'z', pos: number, a0: number, y0: number, w: number, h: number): void {
  for (let y = y0; y < y0 + h; y++)
    for (let a = a0; a < a0 + w; a++) {
      const frame = y === y0 || y === y0 + h - 1 || a === a0 || a === a0 + w - 1;
      const c = frame ? P.steelL : (y - y0) % 2 ? P.dark : P.steelD;
      if (axis === 'z') paint(m, a, y, pos, c);
      else paint(m, pos, y, a, c);
    }
}

/** Bevel: lighten the top edge ring and darken the bottom edge ring of a plate at row `y`. */
export function plateBevel(m: VoxelModel, r: Region, y: number, light: number = P.steelL, dark: number = P.seam): void {
  for (let z = r.z0; z < r.z1; z++)
    for (let x = r.x0; x < r.x1; x++) {
      const lo = x === r.x0 || z === r.z0;
      const hi = x === r.x1 - 1 || z === r.z1 - 1;
      if (lo) paint(m, x, y, z, dark);
      else if (hi) paint(m, x, y, z, light);
    }
}
