import { Color, type BufferGeometry } from 'three';
import { grime, whole } from '../../src/render/voxel/detail';
import { VoxelModel } from '../../src/render/voxel/model';
import { PALETTE } from '../../src/render/voxel/palette';
import { makeRand } from '../../src/render/voxel/rng';
import { bevelMesh } from './bevel';

/** Style 4 density: twice the world's 16 voxels per tile. */
export const RES = 32;

/** Ship palette first (same indices as the game), crew colours appended on demand. */
const table: number[] = PALETTE.map((e) => e.color);
const lookup = new Map<number, number>();
function idx(hex: number): number {
  let i = lookup.get(hex);
  if (i === undefined) {
    i = table.length;
    table.push(hex);
    lookup.set(hex, i);
  }
  return i;
}
const tint = (hex: number, to: number, k: number): number => new Color(hex).lerp(new Color(to), k).getHex();

/** One rigid body part as a 32/tile voxel model, meshed with bevelled edges. Centred on the origin. */
export function voxelPart(kind: 'box' | 'limb' | 'ball', w: number, h: number, d: number, hex: number, taper: number): BufferGeometry {
  const n = (v: number): number => Math.max(1, Math.round(v * RES));
  const nx = n(w), ny = n(h), nz = n(d);
  const m = new VoxelModel(nx, ny, nz);
  const c = idx(hex);
  m.box(0, 0, 0, nx, ny, nz, (x, y, z) => {
    const dx = (x + 0.5 - nx / 2) / (nx / 2), dz = (z + 0.5 - nz / 2) / (nz / 2);
    if (kind === 'ball') return dx * dx + ((y + 0.5 - ny / 2) / (ny / 2)) ** 2 + dz * dz <= 1.02 ? c : 0;
    const s = taper + (1 - taper) * (ny > 1 ? y / (ny - 1) : 1);
    return Math.abs(dx) <= s && Math.abs(dz) <= s ? c : 0;
  });
  const rand = makeRand(hex ^ (nx * 73856093) ^ (ny * 19349663) ^ (nz * 83492791));
  grime(m, whole(m), rand, 0.1, [idx(tint(hex, 0x23282e, 0.45)), idx(tint(hex, 0xffffff, 0.12))], true);
  const g = bevelMesh(m, table.map((hx) => new Color(hx)), 1 / RES, 0.3);
  g.translate(-nx / 2 / RES, -ny / 2 / RES, -nz / 2 / RES);
  return g;
}
