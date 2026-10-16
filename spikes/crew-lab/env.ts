import { Group, Mesh, MeshStandardMaterial, PointLight, type Scene } from 'three';
import { Grid } from '../../src/sim/grid';
import { SHIP_FIELDS, Struct } from '../../src/sim/structure';
import { createGridView, glowMat, type GridView } from '../../src/render/gridView';
import { grime, hazardStripes, whole } from '../../src/render/voxel/detail';
import { meshModel } from '../../src/render/voxel/mesher';
import { VOXEL_SIZE, VoxelModel } from '../../src/render/voxel/model';
import { P } from '../../src/render/voxel/palette';
import { hashKey, makeRand } from '../../src/render/voxel/rng';

export const W = 10;
export const H = 6;
const propMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.12 });

function crate(n: number, key: string): VoxelModel {
  const m = new VoxelModel(n, n - 2, n).box(0, 0, 0, n, n - 2, n, P.steel);
  const all = whole(m);
  m.box(0, 0, 0, n, n - 2, n, (x, y, z) => ((x < 1 || x >= n - 1) && (z < 1 || z >= n - 1)) || ((y < 1 || y >= n - 3) && (x < 1 || x >= n - 1 || z < 1 || z >= n - 1)) ? P.steelD : 0);
  hazardStripes(m, { ...all, y0: 0, y1: 3 }, 2);
  grime(m, all, makeRand(hashKey(key)), 0.2, [P.rust, P.rustD, P.grime]);
  return m;
}

function console_(): VoxelModel {
  const m = new VoxelModel(28, 16, 10);
  m.box(0, 0, 0, 28, 9, 10, P.steelD).box(0, 9, 0, 28, 15, 6, P.steel).box(0, 15, 0, 28, 16, 6, P.steelL);
  m.box(3, 10, 6, 25, 14, 7, P.magenta); // screen
  for (let x = 2; x < 26; x += 3) m.box(x, 9, 7, x + 2, 10, 9, x % 6 ? P.cyan : P.dark);
  grime(m, whole(m), makeRand(7), 0.12, [P.grime, P.rustD, P.seam]);
  return m;
}

function wallLight(): VoxelModel {
  return new VoxelModel(2, 4, 10).box(0, 0, 0, 2, 4, 10, P.steelL).box(1, 1, 1, 2, 3, 9, P.cyan);
}

export interface Env {
  view: GridView;
  group: Group;
  /** Power-dependent lights. */
  lights: PointLight[];
}

/** The real game tiles (gridView + tile models) with props, in tile coordinates offset like the game does. */
export function buildEnv(scene: Scene): Env {
  const grid = new Grid(1, W, H, SHIP_FIELDS);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) grid.set('struct', x, y, x === 0 || y === 0 || x === W - 1 || y === H - 1 ? Struct.Wall : Struct.Floor);
  grid.set('struct', 3, 0, Struct.Door);
  const view = createGridView(grid);
  view.setCutaway('auto');
  scene.add(view.group);

  const group = new Group();
  group.position.set(view.offsetX, 0, view.offsetZ);
  scene.add(group);
  const put = (m: VoxelModel, x: number, y: number, z: number, ry = 0): void => {
    const r = meshModel(m, VOXEL_SIZE);
    for (const [geo, mat] of [[r.solid, propMat], [r.emissive, glowMat]] as const) {
      if (!geo) continue;
      const me = new Mesh(geo, mat);
      me.position.set(x, y, z);
      me.rotation.y = ry;
      me.castShadow = me.receiveShadow = mat === propMat;
      group.add(me);
    }
  };
  put(crate(14, 'c1'), 1.15, 0, 1.15);
  put(crate(12, 'c2'), 1.3, 12 * VOXEL_SIZE, 1.25, 0.25);
  put(crate(10, 'c3'), 2.25, 0, 1.35, -0.2);
  put(console_(), 6, 0, 1);
  put(wallLight(), 1, 1.2, 3.3);

  const cyan = new PointLight(0x9eeeff, 9, 0, 2);
  cyan.position.set(1.5, 1.4, 3.55);
  const mag = new PointLight(0xff2fb4, 3, 0, 2);
  mag.position.set(6.9, 0.9, 1.9);
  group.add(cyan, mag);
  return { view, group, lights: [cyan, mag] };
}
