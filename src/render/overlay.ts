import { Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, PlaneGeometry } from 'three';
import { Struct } from '../sim/structure';
import type { Grid } from '../sim/grid';

/** Distinct hue for a room id (golden-angle spacing). */
export function roomColor(id: number, out: Color): Color {
  return out.setHSL(((id * 0.618034) % 1), 0.7, 0.45);
}

/** Blue -> red ramp, t in [0, 1]. */
export function rampColor(t: number, out: Color): Color {
  return out.setHSL(0.66 * (1 - Math.min(1, Math.max(0, t))), 0.8, 0.42);
}

const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5);
const mat = new MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false });

/** Flat colour quads just above the floor for one grid field. Returns null if nothing to draw. */
export function buildOverlay(grid: Grid, field: string): InstancedMesh | null {
  let data: ArrayLike<number>;
  try {
    data = grid.raw(field);
  } catch {
    return null;
  }
  const struct = grid.raw('struct');
  const room = field === 'room';
  let max = 0;
  if (!room) for (let i = 0; i < data.length; i++) max = Math.max(max, data[i] as number);
  const cells: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const s = struct[i];
    const walkable = s === Struct.Floor || s === Struct.Door;
    if (walkable && (!room || data[i] !== 0)) cells.push(i);
  }
  if (!cells.length) return null;
  const mesh = new InstancedMesh(geo, mat, cells.length);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  const dummy = new Object3D();
  const c = new Color();
  cells.forEach((i, n) => {
    dummy.position.set(i % grid.width, 0.03, Math.floor(i / grid.width));
    dummy.updateMatrix();
    mesh.setMatrixAt(n, dummy.matrix);
    const v = data[i] as number;
    mesh.setColorAt(n, room ? roomColor(v, c) : rampColor(max > 0 ? v / max : 0, c));
  });
  mesh.renderOrder = 5;
  mesh.frustumCulled = false;
  return mesh;
}

export function disposeOverlayShared(): void {
  geo.dispose();
  mat.dispose();
}
