import {
  BoxGeometry, CapsuleGeometry, Color, CylinderGeometry, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, SphereGeometry, type BufferGeometry,
} from 'three';
import { makeRand } from '../voxel/rng';

/** A generated crew model. Feet at y = 0, front is +z, about 1.6 tiles tall. Parts are named pivots. */
export interface CrewModel {
  group: Group;
  hips: Group;
  torso: Group;
  head: Group;
  armL: Group;
  armR: Group;
  elbowL: Group;
  elbowR: Group;
  legL: Group;
  legR: Group;
  kneeL: Group;
  kneeR: Group;
}

export interface CrewParams {
  appearanceSeed: number;
  /** Role content id, e.g. 'role.engineer'. */
  role: string;
  species: string;
}

const SKIN = [0xf1c8a5, 0xd9a07a, 0xb97b52, 0x8a5636, 0x5e3a24];
const HAIR = [0x16110e, 0x3a2414, 0x7a4a22, 0xc9a45a, 0x8c8f96, 0xb02e22];
const JACKET = [0x3b5a8a, 0x56604f, 0x6b4a3a, 0x4a4660];
const HAIR_STYLES = ['short', 'ponytail', 'shaved', 'mohawk'] as const;

const geos = new Map<string, BufferGeometry>();
const mats = new Map<string, MeshStandardMaterial | MeshBasicMaterial>();

function geo(key: string, make: () => BufferGeometry): BufferGeometry {
  let g = geos.get(key);
  if (!g) geos.set(key, (g = make()));
  return g;
}
function mat(color: number): MeshStandardMaterial {
  const key = `s${color}`;
  let m = mats.get(key) as MeshStandardMaterial | undefined;
  if (!m) mats.set(key, (m = new MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0.1 })));
  return m;
}
function glow(color: number): MeshBasicMaterial {
  const key = `g${color}`;
  let m = mats.get(key) as MeshBasicMaterial | undefined;
  if (!m) {
    m = new MeshBasicMaterial({ color, toneMapped: false });
    m.color.multiplyScalar(1.6);
    mats.set(key, m);
  }
  return m;
}

const box = (w: number, h: number, d: number) => geo(`b${w},${h},${d}`, () => new BoxGeometry(w, h, d));
const cyl = (rt: number, rb: number, h: number) => geo(`c${rt},${rb},${h}`, () => new CylinderGeometry(rt, rb, h, 7, 1));
const ball = (r: number) => geo(`i${r}`, () => new IcosahedronGeometry(r, 1));
const lowBall = (r: number) => geo(`l${r}`, () => new SphereGeometry(r, 6, 4));
const capsule = (r: number, h: number) => geo(`p${r},${h}`, () => new CapsuleGeometry(r, h, 2, 6));

function mesh(parent: Group, g: BufferGeometry, m: MeshStandardMaterial | MeshBasicMaterial, x: number, y: number, z: number): Mesh {
  const me = new Mesh(g, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  parent.add(me);
  return me;
}
function pivot(parent: Group, name: string, x: number, y: number, z: number): Group {
  const g = new Group();
  g.name = name;
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

/** Dispose all shared crew geometry and materials (call when the whole crew view goes away). */
export function disposeCrewAssets(): void {
  for (const g of geos.values()) g.dispose();
  for (const m of mats.values()) m.dispose();
  geos.clear();
  mats.clear();
}

export function generateCrew(p: CrewParams): CrewModel {
  const rnd = makeRand(p.appearanceSeed ^ 0x9e3779b9);
  const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)] as T;
  const skin = mat(pick(SKIN));
  const hairMat = mat(pick(HAIR));
  const jacketColor = pick(JACKET);
  const style = pick(HAIR_STYLES);
  const role = p.role.replace(/^role\./, '');
  const jacket = mat(jacketColor);
  const jacketDark = mat(new Color(jacketColor).multiplyScalar(0.6).getHex());
  const pants = mat(0x2a3140);
  const boot = mat(0x1a1c21);

  const group = new Group();
  group.name = 'crew';
  const hips = pivot(group, 'hips', 0, 0.8, 0);
  mesh(hips, box(0.32, 0.16, 0.19), pants, 0, -0.02, 0);

  const leg = (side: 1 | -1, n: string): [Group, Group] => {
    const thigh = pivot(hips, `leg${n}`, side * 0.085, -0.06, 0);
    mesh(thigh, cyl(0.07, 0.058, 0.36), pants, 0, -0.17, 0);
    const knee = pivot(thigh, `knee${n}`, 0, -0.35, 0);
    mesh(knee, cyl(0.058, 0.05, 0.34), pants, 0, -0.16, 0);
    mesh(knee, box(0.1, 0.07, 0.19), boot, 0, -0.34, 0.035);
    return [thigh, knee];
  };
  const [legL, kneeL] = leg(-1, 'L');
  const [legR, kneeR] = leg(1, 'R');

  const torso = pivot(hips, 'torso', 0, 0.04, 0);
  mesh(torso, box(0.34, 0.5, 0.2), jacket, 0, 0.25, 0);
  mesh(torso, box(0.36, 0.06, 0.22), mat(0x2d2a28), 0, 0.02, 0); // belt

  const head = pivot(torso, 'head', 0, 0.52, 0);
  mesh(head, cyl(0.04, 0.045, 0.08), skin, 0, 0.02, 0);
  mesh(head, ball(0.14), skin, 0, 0.17, 0);
  mesh(head, lowBall(0.03), glow(0x22e8ff), 0.065, 0.18, 0.125); // cyber eye
  mesh(head, lowBall(0.022), mat(0x101418), -0.065, 0.18, 0.125);
  if (style === 'short') mesh(head, lowBall(0.15), hairMat, 0, 0.21, -0.025).scale.set(1, 0.8, 1);
  else if (style === 'ponytail') {
    mesh(head, lowBall(0.15), hairMat, 0, 0.21, -0.025).scale.set(1, 0.8, 1);
    mesh(head, capsule(0.04, 0.12), hairMat, 0, 0.12, -0.17);
  } else if (style === 'mohawk') mesh(head, box(0.05, 0.1, 0.24), hairMat, 0, 0.3, -0.02);

  const arm = (side: 1 | -1, n: string): [Group, Group] => {
    const sh = pivot(torso, `arm${n}`, side * 0.23, 0.46, 0);
    mesh(sh, ball(0.07), n === 'R' ? jacketDark : jacket, 0, 0, 0);
    mesh(sh, cyl(0.055, 0.048, 0.26), jacket, 0, -0.13, 0);
    const el = pivot(sh, `elbow${n}`, 0, -0.26, 0);
    mesh(el, cyl(0.048, 0.04, 0.24), jacketDark, 0, -0.12, 0);
    mesh(el, lowBall(0.05), skin, 0, -0.27, 0);
    return [sh, el];
  };
  const [armL, elbowL] = arm(-1, 'L');
  const [armR, elbowR] = arm(1, 'R');

  addRole(role, { torso, head, armL, armR, hips });
  return { group, hips, torso, head, armL, armR, elbowL, elbowR, legL, legR, kneeL, kneeR };
}

function addRole(role: string, p: { torso: Group; head: Group; armL: Group; armR: Group; hips: Group }): void {
  const { torso, head, armL, armR, hips } = p;
  if (role === 'engineer') {
    mesh(torso, box(0.355, 0.4, 0.215), mat(0xe8721c), 0, 0.28, 0);
    for (const y of [0.2, 0.34]) mesh(torso, box(0.365, 0.035, 0.225), mat(0xe9e3b0), 0, y, 0);
    mesh(hips, box(0.38, 0.05, 0.23), mat(0x4a3a28), 0, 0.06, 0);
    mesh(hips, box(0.08, 0.1, 0.06), mat(0x6b6f76), 0.15, 0.0, 0.1);
    mesh(hips, box(0.08, 0.1, 0.06), mat(0x6b6f76), -0.15, 0.0, 0.1);
  } else if (role === 'gunner') {
    mesh(torso, box(0.36, 0.38, 0.23), mat(0x23262c), 0, 0.29, 0);
    mesh(armR, box(0.12, 0.05, 0.14), mat(0x23262c), 0.02, 0.07, 0);
    mesh(armR, lowBall(0.035), glow(0xff2a2a), 0.04, 0.12, 0);
  } else if (role === 'medic') {
    mesh(torso, box(0.355, 0.4, 0.215), mat(0xe9eef0), 0, 0.28, 0);
    mesh(torso, box(0.14, 0.04, 0.225), mat(0x19b6a8), 0, 0.34, 0);
    mesh(torso, box(0.04, 0.14, 0.225), mat(0x19b6a8), 0, 0.34, 0);
    mesh(torso, box(0.26, 0.34, 0.12), mat(0x19b6a8), 0, 0.3, -0.16);
    mesh(armL, box(0.09, 0.07, 0.12), mat(0xe9eef0), -0.01, -0.12, 0).scale.setScalar(1.1);
  } else if (role === 'security') {
    for (const [a, s] of [[armL, -1], [armR, 1]] as const) mesh(a, box(0.18, 0.07, 0.2), mat(0x3b4048), s * 0.03, 0.08, 0);
    mesh(torso, box(0.36, 0.3, 0.225), mat(0x3b4048), 0, 0.3, 0);
  } else if (role === 'pilot') {
    mesh(head, cyl(0.15, 0.15, 0.03), mat(0x20242a), 0, 0.24, 0);
    mesh(head, box(0.32, 0.03, 0.04), mat(0x20242a), 0, 0.23, 0);
    mesh(head, box(0.04, 0.07, 0.05), mat(0x20242a), -0.15, 0.16, 0.0);
    mesh(head, box(0.015, 0.015, 0.1), mat(0x20242a), -0.1, 0.1, 0.1);
  }
}
