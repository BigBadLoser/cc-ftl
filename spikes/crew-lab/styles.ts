import {
  BufferAttribute, BufferGeometry, CapsuleGeometry, Color, CylinderGeometry, IcosahedronGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { hook } from './fx';
import { voxelPart } from './voxpart';

export type Kind = 'box' | 'limb' | 'ball';
export interface Opt { emis?: boolean; taper?: number; r?: [number, number, number] }
export interface Style {
  id: number;
  name: string;
  blurb: string;
  /** Style 1 only: panel-seam lines on the arm plates. */
  seams: boolean;
  mat: MeshStandardMaterial;
  shape(k: Kind, w: number, h: number, d: number, color: number, o?: Opt): Mesh;
  /** Bakes the final vertex colour from the base colour and the rest-pose world position. */
  shade(c: Color, p: Vector3): void;
}

const glows = new Map<number, MeshBasicMaterial>();
/** Unlit emissive (HDR colour so bloom picks it up). Shared, so cyan pulses in unison. */
export function glow(hex: number): MeshBasicMaterial {
  let m = glows.get(hex);
  if (!m) {
    m = new MeshBasicMaterial({ color: hex, toneMapped: false });
    m.color.multiplyScalar(1.6);
    glows.set(hex, m);
  }
  return m;
}

const hash = (x: number, y: number, z: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (t: number): number => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};
const GRIME = new Color(0x23282e);
/** Per-vertex grime noise, darker toward the feet: the ship's wear language. */
function grimy(c: Color, p: Vector3, amount: number): void {
  const n = hash(Math.round(p.x * 26), Math.round(p.y * 26), Math.round(p.z * 26));
  c.multiplyScalar(1 - amount + amount * 1.1 * n).lerp(GRIME, Math.max(0, 1 - p.y / 0.55) * 0.32);
}

// ---- geometry factories -------------------------------------------------------------------------------------

/** Convex hull of the 24 chamfer points = a box with all 12 edges and 8 corners cut. */
function chamfer(w: number, h: number, d: number, c: number, taper = 1): BufferGeometry {
  const pts: Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const t = sy < 0 ? taper : 1;
    const hx = (w / 2) * t, hy = h / 2, hz = (d / 2) * t;
    pts.push(new Vector3(sx * (hx - c), sy * hy, sz * hz), new Vector3(sx * hx, sy * (hy - c), sz * hz), new Vector3(sx * hx, sy * hy, sz * (hz - c)));
  }
  return new ConvexGeometry(pts);
}

function kitbash(k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry {
  const m = Math.min(w, h, d);
  return chamfer(w, h, d, k === 'ball' ? m * 0.3 : Math.min(0.022, m * 0.3), o.taper ?? (k === 'limb' ? 0.88 : 1));
}

function faceted(k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry {
  if (k === 'ball') return new IcosahedronGeometry(0.5, Math.max(w, h, d) < 0.07 ? 0 : 1).scale(w, h, d);
  const top = k === 'box' ? 0.5 : 0.5;
  const t = o.taper ?? (k === 'limb' ? 0.8 : 0.92);
  return new CylinderGeometry(top, top * t, h, k === 'box' ? 6 : 5, 1).scale(w * 1.1, 1, d);
}

function soft(k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry {
  if (k === 'ball') return new SphereGeometry(0.5, 22, 16).scale(w, h, d);
  if (k === 'box') return new RoundedBoxGeometry(w, h, d, 5, Math.min(w, h, d) * 0.48);
  const g = new CapsuleGeometry(0.5, 0.7, 6, 16);
  const p = g.attributes.position as BufferAttribute;
  const t = o.taper ?? 0.85;
  for (let i = 0; i < p.count; i++) {
    const f = t + (1 - t) * (p.getY(i) / 1.7 + 0.5);
    p.setXYZ(i, p.getX(i) * w * f, (p.getY(i) / 1.7) * h * 1.18, p.getZ(i) * d * f);
  }
  g.computeVertexNormals();
  return g;
}

function make(
  id: number, name: string, blurb: string, seams: boolean, mat: MeshStandardMaterial,
  geo: (k: Kind, w: number, h: number, d: number, o: Opt) => BufferGeometry, shade: Style['shade'],
): Style {
  return {
    id, name, blurb, seams, mat, shade,
    shape(k, w, h, d, color, o = {}) {
      const me = new Mesh(geo(k, w, h, d, o), o.emis ? glow(color) : mat);
      me.userData.base = color;
      if (o.r) me.rotation.set(...o.r);
      return me;
    },
  };
}

const std = (flat: boolean, rough: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness: rough, metalness: 0.12 });

export const STYLES: Style[] = [
  make(1, 'Bevelled kitbash', 'chamfered plates, ship grime', true, hook(std(false, 0.92), { grain: 0.07 }), kitbash, (c, p) => grimy(c, p, 0.2)),
  make(2, 'Chunky faceted', 'low-sided prisms, flat shaded', false, hook(std(true, 0.9), { grain: 0.06 }), faceted, (c, p) => grimy(c.multiplyScalar(1.15), p, 0.16)),
  make(3, 'Soft painted', 'smooth, colour blocked, rim', false, hook(std(false, 0.7), { rim: 0.2 }), soft, (c, p) => {
    c.multiplyScalar(0.62 + 0.5 * smooth(p.y / 1.5));
    c.offsetHSL(0, 0.04, 0);
  }),
  make(4, 'Rounded voxel', '32 voxels/tile, bevelled', false, hook(std(false, 0.9), {}),
    () => new BufferGeometry(), (c, p) => {
      c.multiplyScalar(0.78 + 0.27 * smooth(p.y / 1.5));
    }),
];

/** Style 4 needs the real colour at voxelisation time, so it overrides `shape`. */
const vox = STYLES[3] as Style;
vox.shape = (k, w, h, d, color, o = {}) => {
  const g = voxelPart(k, w, h, d, color, o.taper ?? (k === 'limb' ? 0.85 : 1));
  const me = new Mesh(g, o.emis ? glow(color) : vox.mat);
  me.userData.base = color;
  if (o.r) me.rotation.set(...o.r);
  return me;
};

/** Bake vertex colours in the rest pose (call right after building, before the crew is moved). */
export function bake(root: Object3D, S: Style): void {
  root.updateMatrixWorld(true);
  const v = new Vector3();
  const c = new Color();
  root.traverse((o) => {
    const me = o as Mesh;
    if (!me.isMesh || me.userData.base === undefined || me.material !== S.mat) return;
    const p = me.geometry.attributes.position as BufferAttribute;
    const have = me.geometry.getAttribute('color') as BufferAttribute | undefined;
    const arr = have ? (have.array as Float32Array) : new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld);
      if (have) c.fromArray(arr, i * 3);
      else c.setHex(me.userData.base as number);
      S.shade(c, v);
      c.toArray(arr, i * 3);
    }
    if (!have) me.geometry.setAttribute('color', new BufferAttribute(arr, 3));
  });
}
