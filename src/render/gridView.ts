import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Vector3,
  type InstancedMesh as IM,
} from 'three';
import type { Grid } from '../sim/grid';
import { Struct } from '../sim/structure';
import { disposeTileGeometry, tileGeometry, FLOOR_H, type TileModelKey } from './models/tiles';
import { VOXEL_SIZE } from './voxel/model';
import { buildOverlay } from './overlay';

export type CutawayMode = 'auto' | 'up' | 'down';

export interface GridView {
  group: Group;
  /** Grid being shown. */
  readonly grid: Grid;
  /** World offset of tile (0, 0)'s min corner inside `group`'s parent space (group is centred on the grid). */
  readonly offsetX: number;
  readonly offsetZ: number;
  update(): void;
  setCutaway(mode: CutawayMode): void;
  setOverlay(field: string | null): void;
  setSelection(tile: { x: number; y: number } | null): void;
  setHover(tile: { x: number; y: number } | null): void;
  /** Highlight a set of tiles (drag-paint preview). Empty clears. */
  setPreview(tiles: readonly { x: number; y: number }[]): void;
  dispose(): void;
}

const solidMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.12 });
/** Colour > 1 so emissive voxels clear the bloom threshold. */
export const glowMat = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
glowMat.color.setScalar(1.6);

const frameMat = new MeshBasicMaterial({ color: 0x22d3ee, toneMapped: false, transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
frameMat.color.multiplyScalar(1.6);
const hoverMat = frameMat.clone();
hoverMat.opacity = 0.45;

/** Square ring of 8 triangles around a unit tile, `t` thick, lying at Y = 0.05. */
function frameGeometry(t: number): BufferGeometry {
  const o = [0, 1], i = [t, 1 - t];
  const v = [o[0], o[0], o[1], o[0], o[1], o[1], o[0], o[1], i[0], i[0], i[1], i[0], i[1], i[1], i[0], i[1]];
  const pos: number[] = [];
  for (let k = 0; k < 16; k += 2) pos.push(v[k] as number, 0.05, v[k + 1] as number);
  const idx: number[] = [];
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4;
    idx.push(k, n, 4 + k, n, 4 + n, 4 + k);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const frameGeo = frameGeometry(0.07);

const ROT = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

export function createGridView(grid: Grid): GridView {
  const group = new Group();
  const offsetX = -grid.width / 2;
  const offsetZ = -grid.height / 2;
  group.position.set(offsetX, 0, offsetZ);
  const content = new Group();
  const overlayGroup = new Group();
  const selMesh = new Mesh(frameGeo, frameMat);
  const hoverMesh = new Mesh(frameGeo, hoverMat);
  for (const m of [selMesh, hoverMesh]) {
    m.visible = false;
    m.renderOrder = 10;
    m.frustumCulled = false;
  }
  group.add(content, overlayGroup, hoverMesh, selMesh);
  const previewPool: Mesh[] = [];

  let mode: CutawayMode = 'auto';
  let structRev = -1;
  let builtMode: CutawayMode | null = null;
  let overlayField: string | null = null;
  let overlayKey = '';
  let meshes: IM[] = [];

  const kindAt = (x: number, y: number): number => (grid.inBounds(x, y) ? grid.get('struct', x, y) : Struct.Space);
  const isInterior = (x: number, y: number): boolean => {
    const k = kindAt(x, y);
    return k === Struct.Floor || k === Struct.Door;
  };
  const touchesSpace = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && kindAt(x + dx, y + dy) === Struct.Space) return true;
    return false;
  };
  /** Camera looks toward -X/-Z, so interior behind a tile is at lower x / y. */
  const lowered = (x: number, y: number): boolean => {
    if (mode === 'up') return false;
    if (mode === 'down') return true;
    return isInterior(x - 1, y) || isInterior(x, y - 1) || isInterior(x - 1, y - 1);
  };
  const isSolidish = (x: number, y: number): boolean => {
    const k = kindAt(x, y);
    return k === Struct.Wall || k === Struct.Door;
  };

  function rebuild(): void {
    for (const m of meshes) {
      content.remove(m);
      m.dispose();
    }
    meshes = [];
    const lists = new Map<TileModelKey, Matrix4[]>();
    const add = (key: TileModelKey, m: Matrix4): void => {
      const l = lists.get(key);
      if (l) l.push(m);
      else lists.set(key, [m]);
    };
    const pos = new Vector3();
    const one = new Vector3(1, 1, 1);
    const q = new Quaternion();
    const half = new Vector3();
    for (let y = 0; y < grid.height; y++)
      for (let x = 0; x < grid.width; x++) {
        const k = kindAt(x, y);
        if (k === Struct.Space) continue;
        if (k === Struct.Floor || k === Struct.Door) add('floor', new Matrix4().makeTranslation(x, -FLOOR_H * VOXEL_SIZE, y));
        if (k === Struct.Floor) continue;
        const low = lowered(x, y);
        if (k === Struct.Wall) {
          const key: TileModelKey = touchesSpace(x, y) ? (low ? 'wall.hull.low' : 'wall.hull') : low ? 'wall.low' : 'wall.full';
          add(key, new Matrix4().makeTranslation(x, 0, y));
        } else {
          // Slab runs along X when walls flank it in X, otherwise turn it a quarter.
          const alongX = isSolidish(x - 1, y) && isSolidish(x + 1, y);
          q.copy(alongX ? new Quaternion() : ROT);
          pos.set(x, 0, y);
          if (!alongX) {
            half.set(0.5, 0, 0.5).sub(new Vector3(0.5, 0, 0.5).applyQuaternion(q));
            pos.add(half);
          }
          add(low ? 'door.low' : 'door', new Matrix4().compose(pos, q, one));
        }
      }
    for (const [key, mats] of lists) {
      const g = tileGeometry(key);
      for (const [geo, mat, solid] of [[g.solid, solidMat, true], [g.emissive, glowMat, false]] as const) {
        if (!geo) continue;
        const mesh = new InstancedMesh(geo, mat, mats.length);
        mats.forEach((m, i) => mesh.setMatrixAt(i, m));
        mesh.castShadow = solid;
        mesh.receiveShadow = solid;
        mesh.frustumCulled = false;
        content.add(mesh);
        meshes.push(mesh);
      }
    }
    builtMode = mode;
  }

  function rebuildOverlay(): void {
    for (const c of [...overlayGroup.children]) {
      overlayGroup.remove(c);
      (c as IM).dispose();
    }
    if (!overlayField) return;
    const m = buildOverlay(grid, overlayField);
    if (m) overlayGroup.add(m);
  }

  return {
    group,
    grid,
    offsetX,
    offsetZ,
    update() {
      const rev = grid.revision('struct');
      if (rev !== structRev || builtMode !== mode) {
        rebuild();
        structRev = rev;
        overlayKey = ''; // struct changed: overlay footprint may have too
      }
      if (overlayField) {
        let fieldRev = -1;
        try {
          fieldRev = grid.revision(overlayField);
        } catch {
          fieldRev = -2;
        }
        const key = `${overlayField}:${fieldRev}:${structRev}`;
        if (key !== overlayKey) {
          overlayKey = key;
          rebuildOverlay();
        }
      }
    },
    setCutaway(m) {
      mode = m;
    },
    setOverlay(field) {
      overlayField = field;
      overlayKey = '';
      if (!field) rebuildOverlay();
    },
    setSelection(t) {
      selMesh.visible = t !== null;
      if (t) selMesh.position.set(t.x, 0, t.y);
    },
    setPreview(tiles) {
      while (previewPool.length < tiles.length) {
        const m = new Mesh(frameGeo, hoverMat);
        m.renderOrder = 10;
        m.frustumCulled = false;
        previewPool.push(m);
        group.add(m);
      }
      previewPool.forEach((m, i) => {
        const t = tiles[i];
        m.visible = t !== undefined;
        if (t) m.position.set(t.x, 0, t.y);
      });
    },
    setHover(t) {
      hoverMesh.visible = t !== null;
      if (t) hoverMesh.position.set(t.x, 0, t.y);
    },
    dispose() {
      for (const m of meshes) m.dispose();
      meshes = [];
      rebuildOverlayDispose();
      disposeTileGeometry();
    },
  };

  function rebuildOverlayDispose(): void {
    overlayField = null;
    rebuildOverlay();
  }
}
