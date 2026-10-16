import {
  BufferAttribute, BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Vector3, type Object3D,
} from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hook } from './fx';

export type Kind = 'box' | 'limb' | 'ball';
/** `mech`: a machine part (cyber-arm, tool rig, soles...). Only style 3 treats it differently. */
export interface Opt { emis?: boolean; taper?: number; r?: [number, number, number]; mech?: boolean }
export interface Style {
  id: number;
  name: string;
  blurb: string;
  /** Panel seams on the cyber-arm plates. */
  seams: boolean;
  /** Idle forward lean in radians and relaxed posture. */
  lean: number;
  mat: MeshStandardMaterial;
  matMech?: MeshStandardMaterial;
  shape(k: Kind, w: number, h: number, d: number, color: number, o?: Opt): Mesh;
  shade(c: Color, p: Vector3): void;
}

/** One shared unlit emissive material with HDR vertex colours: every glow merges into one mesh per bone. */
export const GLOW = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });

const hash = (x: number, y: number, z: number): number => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};
const GRIME = new Color(0x23282e);
/** Per-vertex grime noise, darker toward the feet: the ship's wear language. */
function grimy(c: Color, p: Vector3, amount: number, low: number): void {
  const n = hash(Math.round(p.x * 26), Math.round(p.y * 26), Math.round(p.z * 26));
  c.multiplyScalar(1 - amount + amount * 1.1 * n).lerp(GRIME, Math.max(0, 1 - p.y / 0.55) * low);
}

// ---- geometry factories --------------------------------------------------------------------------------------

/** Convex hull of the 24 chamfer points = a box with all 12 edges and 8 corners cut. */
function chamferBox(w: number, h: number, d: number, c: number, taper = 1): BufferGeometry {
  const pts: Vector3[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const t = sy < 0 ? taper : 1;
    const hx = (w / 2) * t, hy = h / 2, hz = (d / 2) * t;
    pts.push(new Vector3(sx * (hx - c), sy * hy, sz * hz), new Vector3(sx * hx, sy * (hy - c), sz * hz), new Vector3(sx * hx, sy * hy, sz * (hz - c)));
  }
  return new ConvexGeometry(pts);
}

const kitbash = (k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry => {
  const m = Math.min(w, h, d);
  return chamferBox(w, h, d, k === 'ball' ? m * 0.3 : Math.min(0.03, m * 0.35), o.taper ?? (k === 'limb' ? 0.88 : 1));
};

const sidesOf = (k: Kind): number => (k === 'box' ? 6 : 5);
const taperOf = (k: Kind, o: Opt): number => o.taper ?? (k === 'limb' ? 0.8 : 0.92);

function faceted(k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry {
  if (k === 'ball') return new IcosahedronGeometry(0.5, Math.max(w, h, d) < 0.07 ? 0 : 1).scale(w, h, d);
  return new CylinderGeometry(0.5, 0.5 * taperOf(k, o), h, sidesOf(k), 1).scale(w * 1.1, 1, d);
}

/** A faceted prism whose top/bottom rims and vertical polygon corners are all chamfered (hull of cut rings). */
function chamferedFacets(k: Kind, w: number, h: number, d: number, o: Opt): BufferGeometry {
  if (k === 'ball') return faceted(k, w, h, d, o);
  const n = sidesOf(k), t = taperOf(k, o);
  const c = Math.min(0.022, Math.min(w, h, d) * 0.3);
  const inset = Math.max(0.55, 1 - c / (0.5 * Math.min(w, d)));
  const pts: Vector3[] = [];
  for (const sy of [-1, 1]) {
    const rt = sy < 0 ? t : 1;
    for (const [y, rs] of [[sy * (h / 2 - c), 1], [sy * (h / 2), inset]] as const) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2, z = ((i + n - 1) / n) * Math.PI * 2;
        const v = [Math.sin(a), Math.cos(a)], nx = [Math.sin(b), Math.cos(b)], pv = [Math.sin(z), Math.cos(z)];
        for (const q of [nx, pv]) {
          const px = (v[0]! + (q[0]! - v[0]!) * 0.24) * 0.5 * rs * rt, pz = (v[1]! + (q[1]! - v[1]!) * 0.24) * 0.5 * rs * rt;
          pts.push(new Vector3(px * w * 1.1, y, pz * d));
        }
      }
    }
  }
  return new ConvexGeometry(pts);
}

function make(
  id: number, name: string, blurb: string, o: { seams: boolean; lean: number }, mat: MeshStandardMaterial,
  geo: (k: Kind, w: number, h: number, d: number, o: Opt) => BufferGeometry, shade: Style['shade'], mech?: [MeshStandardMaterial, typeof geo],
): Style {
  return {
    id, name, blurb, seams: o.seams, lean: o.lean, mat, matMech: mech?.[0], shade,
    shape(k, w, h, d, color, op = {}) {
      const useMech = !!(op.mech && mech);
      const g = (useMech ? mech![1] : geo)(k, w, h, d, op);
      const me = new Mesh(g, op.emis ? GLOW : useMech ? mech![0] : mat);
      me.userData.base = color;
      if (op.emis) {
        const c = new Color(color).multiplyScalar(1.15);
        g.setAttribute('color', new Float32BufferAttribute(Array.from({ length: g.attributes.position!.count }, () => [c.r, c.g, c.b]).flat(), 3));
      }
      if (op.r) me.rotation.set(...op.r);
      return me;
    },
  };
}

const std = (flat: boolean, rough: number): MeshStandardMaterial =>
  new MeshStandardMaterial({ vertexColors: true, flatShading: flat, roughness: rough, metalness: 0.12 });

const clean = (c: Color, p: Vector3): void => grimy(c.multiplyScalar(1.22), p, 0.08, 0.14);

export const STYLES: Style[] = [
  make(1, 'Kitbash refined', 'bigger chamfers, leaning posture', { seams: true, lean: 0.1 }, hook(std(false, 0.9), { grain: 0.06 }), kitbash, (c, p) => grimy(c.multiplyScalar(0.98), p, 0.18, 0.3)),
  make(2, 'Faceted refined', 'clean colour blocks, face read', { seams: false, lean: 0.04 }, hook(std(true, 0.88), { grain: 0.04 }), faceted, clean),
  make(3, 'Faceted flesh, kitbash machine', 'prisms = flesh, plates = machine', { seams: true, lean: 0.04 }, hook(std(true, 0.88), { grain: 0.04 }), faceted, clean,
    [hook(std(false, 0.6), { grain: 0.05 }), kitbash]),
  make(4, 'Chamfered facets', 'faceted + bevels + seams + grime', { seams: true, lean: 0.06 }, hook(std(true, 0.88), { grain: 0.06 }), chamferedFacets, (c, p) => grimy(c.multiplyScalar(1.15), p, 0.16, 0.26)),
];

/** Bake vertex colours in the rest pose (call right after building, before the crew is moved). */
export function bake(root: Object3D, S: Style): void {
  root.updateMatrixWorld(true);
  const v = new Vector3();
  const c = new Color();
  root.traverse((o) => {
    const me = o as Mesh;
    if (!me.isMesh || me.userData.base === undefined || (me.material !== S.mat && me.material !== S.matMech)) return;
    const p = me.geometry.attributes.position as BufferAttribute;
    const arr = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(me.matrixWorld);
      c.setHex(me.userData.base as number);
      S.shade(c, v);
      c.toArray(arr, i * 3);
    }
    me.geometry.setAttribute('color', new BufferAttribute(arr, 3));
  });
}

/** Merge each bone's static parts into one mesh per material (glow shares one material, so one mesh). */
export function mergeBones(root: Object3D): void {
  const bones: Group[] = [];
  root.traverse((o) => { if ((o as Group).isGroup) bones.push(o as Group); });
  for (const bone of bones) {
    const byMat = new Map<unknown, Mesh[]>();
    for (const ch of bone.children) {
      const me = ch as Mesh;
      if (!me.isMesh || me.userData.base === undefined) continue;
      byMat.set(me.material, [...(byMat.get(me.material) ?? []), me]);
    }
    for (const [mat, list] of byMat) {
      const geos = list.map((me) => {
        me.updateMatrix();
        let g = me.geometry.clone();
        g.deleteAttribute('uv');
        if (g.index) g = g.toNonIndexed();
        return g.applyMatrix4(me.matrix);
      });
      const merged = new Mesh(mergeGeometries(geos, false), mat as MeshStandardMaterial);
      merged.castShadow = mat !== GLOW;
      merged.userData.merged = true;
      for (const me of list) {
        bone.remove(me);
        me.geometry.dispose();
      }
      bone.add(merged);
    }
  }
}
