import { meshModel, type MeshResult } from '../voxel/mesher';
import { VOXEL_SIZE, VOXELS_PER_TILE, VoxelModel } from '../voxel/model';
import { P } from '../voxel/palette';
import { grille, grime, hazardStripes, hazardTop, panelSeams, plateBevel, rivets, whole } from '../voxel/detail';
import { hashKey, makeRand } from '../voxel/rng';

const T = VOXELS_PER_TILE;
/** Full wall height in voxels (~2.5 tiles). */
export const WALL_FULL_H = 40;
/** Cutaway wall height in voxels. */
export const WALL_LOW_H = 4;
/** Floor slab thickness in voxels; floor instances sit this far below Y = 0. */
export const FLOOR_H = 2;

export type TileModelKey = 'floor' | 'wall.full' | 'wall.hull' | 'wall.low' | 'wall.hull.low' | 'door' | 'door.low';

function floor(key: string): VoxelModel {
  const rand = makeRand(hashKey(key));
  const m = new VoxelModel(T, FLOOR_H, T);
  m.box(0, 0, 0, T, 1, T, P.dark);
  m.box(0, 1, 0, T, 2, T, P.plateA);
  const top = { x0: 0, y0: 1, z0: 0, x1: T, y1: 2, z1: T };
  // Faint seams on two edges, bolts near the corners, sparse grime.
  m.box(0, 1, 0, T, 2, T, (x, _y, z) => (x === 0 || z === 0 ? P.seam : 0));
  for (const [x, z] of [[2, 2], [13, 2], [2, 13], [13, 13]] as const) m.set(x, 1, z, P.bolt);
  grime(m, top, rand, 0.09, [P.plateB, P.plateC, P.grime]);
  return m;
}

function wall(key: string, h: number, hull: boolean): VoxelModel {
  const rand = makeRand(hashKey(key));
  const m = new VoxelModel(T, h, T);
  const body = hull ? P.blueGrey : P.steel;
  m.box(0, 0, 0, T, h, T, body);
  const all = whole(m);
  if (h > WALL_LOW_H) {
    panelSeams(m, all, hull ? 8 : 10, P.steelD);
    rivets(m, all, 3, 4);
    rivets(m, all, h - 4, 4);
    if (hull) {
      m.box(0, h - 6, 0, T, h - 4, T, P.steelD); // heavy belt course
      hazardStripes(m, { ...all, y1: 4 }, 2);
    }
    grime(m, { ...all, y1: Math.min(h, 22) }, rand, hull ? 0.12 : 0.24, [P.rust, P.rustD, P.grime], true);
  } else if (hull) {
    hazardTop(m, all, 4);
  }
  if (h > WALL_LOW_H || !hull) {
    m.box(0, h - 1, 0, T, h, T, P.steelL);
    plateBevel(m, { ...all, y1: h }, h - 1, P.steelL, P.steelD);
  }
  return m;
}

function door(h: number): VoxelModel {
  const m = new VoxelModel(T, h, T);
  const full = h > WALL_LOW_H;
  const zA = 6;
  const zB = 10;
  m.box(0, 0, zA - 1, T, h, zB + 1, P.steelD); // frame body spans the doorway
  if (full) {
    m.box(2, 0, zA, T - 2, 32, zB, P.steel); // door leaf
    m.box(8, 0, zA, 9, 32, zB, P.seam); // centre split
    m.box(0, 32, 0, T, h, T, P.steel); // lintel across the full footprint
    m.box(0, h - 1, 0, T, h, T, P.steelL);
    hazardStripes(m, { x0: 2, y0: 0, z0: zA, x1: T - 2, y1: 3, z1: zB }, 2);
    for (const z of [zA, zB - 1]) m.box(11, 26, z, 13, 29, z + 1, P.cyan);
    grille(m, 3, 14, 7, 20, zA);
    grille(m, 3, 14, 7, 20, zB - 1);
  } else {
    m.box(0, 0, zA - 1, T, h, zB + 1, P.steel);
    m.box(0, h - 1, zA - 1, T, h, zB + 1, P.steelL);
    for (const z of [zA - 1, zB]) m.box(11, h - 2, z, 13, h - 1, z + 1, P.cyan);
  }
  return m;
}

const builders: Record<TileModelKey, () => VoxelModel> = {
  floor: () => floor('floor'),
  'wall.full': () => wall('wall.full', WALL_FULL_H, false),
  'wall.hull': () => wall('wall.hull', WALL_FULL_H, true),
  'wall.low': () => wall('wall.low', WALL_LOW_H, false),
  'wall.hull.low': () => wall('wall.hull.low', WALL_LOW_H, true),
  door: () => door(WALL_FULL_H),
  'door.low': () => door(WALL_LOW_H),
};

const cache = new Map<TileModelKey, MeshResult>();

/** Meshed geometry (world units, origin at the tile's min corner, bottom at y = 0) for a tile model; cached. */
export function tileGeometry(key: TileModelKey): MeshResult {
  let r = cache.get(key);
  if (!r) {
    r = meshModel(builders[key](), VOXEL_SIZE);
    cache.set(key, r);
  }
  return r;
}

/** Free cached geometry (e.g. on renderer dispose). */
export function disposeTileGeometry(): void {
  for (const r of cache.values()) {
    r.solid?.dispose();
    r.emissive?.dispose();
  }
  cache.clear();
}
