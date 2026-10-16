import { Group, Mesh, MeshBasicMaterial, BoxGeometry, SphereGeometry, Vector3, type Object3D } from 'three';
import { bake, mergeBones, type Kind, type Opt, type Style } from './styles';

/** Shared palette: ship tones for metal/grime, desaturated olive for the clothes. */
export const C = {
  jacket: 0x72845f, jacketD: 0x56674a, pants: 0x4a4f5c, pocket: 0x5c6270, boot: 0x23272d, toe: 0x59646f, black: 0x14161a,
  skin: 0xd49c74, skinD: 0xb47f5a, glove: 0x2d2822, leather: 0x3a2a1e, hivis: 0xe0701a, yellow: 0xc9a227, mohawk: 0x8c1d28,
  gm: 0x59646f, gmD: 0x3b434e, plate: 0x6f7b87, dark: 0x12161b, seam: 0x1f242a, brass: 0x9a7b2e, lens: 0x86bfcc, strap: 0x2b3138,
  torn: 0x6e4129, cyan: 0x19e6ff, magenta: 0xff2fb4,
};

export type Mode = 'idle' | 'walk' | 'work';
export interface Crew {
  root: Group; hips: Group; torso: Group; head: Group; shL: Group; shR: Group; elL: Group; elR: Group;
  hipL: Group; hipR: Group; knL: Group; knR: Group; pack: Group; tool: Group; handL: Group; arc: Mesh; lean: number;
}

const grp = (p: Object3D, x = 0, y = 0, z = 0): Group => {
  const g = new Group();
  g.position.set(x, y, z);
  p.add(g);
  return g;
};

/** One engineer, ~1.5 tiles tall, front = +z. Identical hierarchy and proportions for every style. */
export function buildCrew(S: Style): Crew {
  const root = new Group();
  const at = (p: Object3D, k: Kind, w: number, h: number, d: number, c: number, x: number, y: number, z: number, o?: Opt): Mesh => {
    const m = S.shape(k, w, h, d, c, o);
    m.position.set(x, y, z);
    m.castShadow = true;
    p.add(m);
    return m;
  };
  const hips = grp(root, 0, 0.5, 0);
  at(hips, 'box', 0.5, 0.2, 0.32, C.pants, 0, 0, 0);

  const leg = (s: number): [Group, Group] => {
    const th = grp(hips, s * 0.14, -0.05, 0);
    at(th, 'limb', 0.23, 0.26, 0.25, C.pants, 0, -0.12, 0, { taper: 0.88 });
    at(th, 'box', 0.06, 0.13, 0.17, C.pocket, s * 0.125, -0.1, 0);
    const kn = grp(th, 0, -0.23, 0);
    at(kn, 'limb', 0.21, 0.2, 0.22, C.pants, 0, -0.07, 0, { taper: 0.92 });
    at(kn, 'box', 0.25, 0.16, 0.3, C.boot, 0, -0.14, 0.04);
    at(kn, 'box', 0.24, 0.07, 0.13, C.toe, 0, -0.16, 0.2, { mech: true });
    at(kn, 'box', 0.27, 0.04, 0.33, C.black, 0, -0.2, 0.04, { mech: true });
    return [th, kn];
  };
  const [hipL, knL] = leg(1);
  const [hipR, knR] = leg(-1);

  const torso = grp(hips, 0, 0.07, 0);
  at(torso, 'box', 0.6, 0.46, 0.36, C.jacket, 0, 0.23, 0, { taper: 1 });
  for (const y of [0.17, 0.3]) at(torso, 'box', 0.615, 0.045, 0.372, C.hivis, 0, y, 0, { taper: 1 });
  for (const s of [-1, 1]) {
    at(torso, 'box', 0.07, 0.2, 0.375, C.hivis, s * 0.15, 0.37, 0, { taper: 1 });
    at(torso, 'box', 0.2, 0.12, 0.3, C.jacketD, s * 0.33, 0.43, 0);
    at(torso, 'box', 0.12, 0.1, 0.09, C.leather, s * 0.23, 0, 0.2);
  }
  at(torso, 'box', 0.34, 0.06, 0.26, C.jacketD, 0, 0.49, 0);
  at(torso, 'box', 0.63, 0.075, 0.39, C.leather, 0, 0.01, 0, { taper: 1 });
  for (let i = 0; i < 4; i++) at(torso, 'box', 0.06, 0.06, 0.02, i % 2 ? C.black : C.yellow, -0.09 + i * 0.06, 0.01, 0.2, { mech: true });
  at(torso, 'box', 0.09, 0.08, 0.03, C.plate, 0, 0.01, 0.215, { mech: true });
  at(torso, 'box', 0.09, 0.08, 0.07, C.leather, 0, -0.01, -0.2);

  const head = grp(torso, 0, 0.5, 0);
  at(head, 'limb', 0.15, 0.1, 0.15, C.skinD, 0, 0.02, 0);
  at(head, 'ball', 0.31, 0.32, 0.3, C.skin, 0, 0.18, 0);
  at(head, 'box', 0.05, 0.08, 0.07, C.skinD, 0, 0.155, 0.17, { r: [0.45, 0, 0] }); // nose wedge
  at(head, 'box', 0.27, 0.04, 0.07, C.skinD, 0, 0.245, 0.14); // brow ridge
  at(head, 'box', 0.22, 0.07, 0.2, C.skin, 0, 0.065, 0.07); // jaw
  at(head, 'box', 0.06, 0.035, 0.02, C.black, 0.085, 0.2, 0.15);
  at(head, 'box', 0.1, 0.1, 0.06, C.gm, -0.085, 0.2, 0.145, { mech: true });
  at(head, 'ball', 0.065, 0.065, 0.05, C.cyan, -0.085, 0.2, 0.168, { emis: true });
  at(head, 'box', 0.04, 0.08, 0.08, C.gmD, 0.155, 0.2, 0, { mech: true });
  at(head, 'box', 0.03, 0.04, 0.05, C.magenta, 0.178, 0.2, 0, { emis: true });
  at(head, 'box', 0.335, 0.05, 0.325, C.strap, 0, 0.27, 0);
  for (const s of [-1, 1]) {
    at(head, 'box', 0.11, 0.09, 0.05, C.brass, s * 0.075, 0.285, 0.165, { mech: true });
    at(head, 'box', 0.075, 0.06, 0.02, C.lens, s * 0.075, 0.285, 0.195);
  }
  at(head, 'box', 0.065, 0.1, 0.12, C.mohawk, 0, 0.37, 0.08, { taper: 0.8 });
  at(head, 'box', 0.065, 0.16, 0.12, C.mohawk, 0, 0.39, -0.03, { taper: 0.8 });
  at(head, 'box', 0.065, 0.11, 0.1, C.mohawk, 0, 0.34, -0.13, { taper: 0.8 });

  // Right arm: jacket sleeve, hi-vis band, work glove.
  const shR = grp(torso, -0.38, 0.4, 0);
  at(shR, 'limb', 0.2, 0.24, 0.2, C.jacket, 0, -0.11, 0, { taper: 0.9 });
  at(shR, 'box', 0.21, 0.035, 0.21, C.hivis, 0, -0.07, 0);
  const elR = grp(shR, 0, -0.23, 0);
  at(elR, 'limb', 0.18, 0.22, 0.18, C.jacket, 0, -0.1, 0, { taper: 0.85 });
  at(elR, 'box', 0.195, 0.045, 0.195, C.jacketD, 0, -0.2, 0);
  at(elR, 'box', 0.17, 0.15, 0.17, C.glove, 0, -0.27, 0.01);
  at(elR, 'box', 0.05, 0.07, 0.1, C.glove, 0.1, -0.24, 0.05); // thumb block
  const handR = grp(elR, 0, -0.28, 0.04);
  const tool = grp(handR);
  at(tool, 'box', 0.04, 0.3, 0.04, C.plate, 0, 0.1, 0.04, { r: [-1.3, 0, 0], mech: true });
  at(tool, 'ball', 0.12, 0.1, 0.06, C.gm, 0, 0.12, 0.2, { mech: true });
  tool.visible = false;

  // Left arm: sleeve torn off at the shoulder; bulky gunmetal cyber-arm with wide cyan strips and glowing wrist ring.
  const M = { mech: true };
  const shL = grp(torso, 0.4, 0.4, 0);
  at(shL, 'limb', 0.23, 0.1, 0.23, C.jacket, 0, -0.04, 0, { taper: 1 });
  at(shL, 'box', 0.24, 0.025, 0.24, C.torn, 0, -0.095, 0);
  at(shL, 'limb', 0.21, 0.2, 0.21, C.gmD, 0, -0.17, 0, { taper: 0.9, ...M });
  at(shL, 'box', 0.23, 0.09, 0.23, C.gm, 0, -0.15, 0, M);
  const elL = grp(shL, 0, -0.25, 0);
  at(elL, 'box', 0.18, 0.17, 0.18, C.dark, 0, 0, 0, M);
  at(elL, 'box', 0.24, 0.24, 0.24, C.gm, 0, -0.15, 0, { taper: 0.92, ...M });
  at(elL, 'box', 0.05, 0.19, 0.17, C.plate, 0.12, -0.15, 0, M);
  at(elL, 'box', 0.03, 0.2, 0.06, C.cyan, 0.15, -0.15, 0, { emis: true });
  at(elL, 'box', 0.06, 0.18, 0.025, C.cyan, 0, -0.15, 0.13, { emis: true });
  at(elL, 'box', 0.26, 0.02, 0.26, C.cyan, 0, -0.275, 0, { emis: true });
  if (S.seams) for (const y of [-0.07, -0.22]) at(elL, 'box', 0.245, 0.016, 0.245, C.seam, 0, y, 0, M);
  if (S.seams) for (const y of [-0.2, -0.12]) at(shL, 'box', 0.235, 0.016, 0.235, C.seam, 0, y, 0, M);
  at(elL, 'box', 0.22, 0.17, 0.22, C.gmD, 0, -0.35, 0.01, M);
  at(elL, 'box', 0.06, 0.08, 0.12, C.gm, 0.13, -0.31, 0.05, M); // thumb block
  at(elL, 'box', 0.12, 0.03, 0.04, C.cyan, 0, -0.29, 0.125, { emis: true }); // glowing knuckles
  const handL = grp(elL, 0, -0.36, 0.14);
  const arc = new Mesh(new SphereGeometry(0.06, 8, 6), new MeshBasicMaterial({ color: 0xcff8ff, toneMapped: false }));
  arc.scale.setScalar(0.001);
  handL.add(arc);

  // Backpack with the tool rig poking up: wrench (right) and cutter (left).
  const pack = grp(torso, 0, 0.27, -0.26);
  at(pack, 'box', 0.42, 0.38, 0.16, C.gmD, 0, 0, 0, { mech: true });
  at(pack, 'box', 0.3, 0.2, 0.04, C.gm, 0, 0, -0.1, { mech: true });
  for (const s of [-1, 1]) at(pack, 'limb', 0.1, 0.3, 0.1, C.yellow, s * 0.2, -0.03, 0.02, { taper: 1, mech: true });
  at(pack, 'box', 0.04, 0.04, 0.03, C.cyan, 0.12, 0.12, -0.12, { emis: true });
  at(pack, 'box', 0.04, 0.42, 0.035, C.plate, 0.1, 0.4, -0.02, { r: [0, 0, -0.12], mech: true });
  at(pack, 'ball', 0.12, 0.1, 0.05, C.plate, 0.14, 0.62, -0.02, { mech: true });
  at(pack, 'box', 0.045, 0.05, 0.06, C.dark, 0.14, 0.65, -0.02, { mech: true });
  at(pack, 'box', 0.035, 0.36, 0.03, C.gm, -0.1, 0.38, -0.02, { r: [0, 0, 0.14], mech: true });
  at(pack, 'box', 0.035, 0.34, 0.03, C.plate, -0.07, 0.37, -0.02, { r: [0, 0, -0.1], mech: true });
  at(pack, 'box', 0.06, 0.12, 0.045, C.hivis, -0.08, 0.2, -0.02, { mech: true });

  bake(root, S);
  mergeBones(root);
  return { root, hips, torso, head, shL, shR, elL, elR, hipL, hipR, knL, knR, pack, tool, handL, arc, lean: S.lean };
}

const sin = Math.sin;
export function pose(c: Crew, t: number, mode: Mode): void {
  const { hips, torso, head, shL, shR, elL, elR, hipL, hipR, knL, knR, pack } = c;
  hips.position.y = 0.5;
  hips.rotation.set(0, 0, 0);
  torso.rotation.set(0, 0, 0);
  torso.scale.set(1, 1, 1);
  head.rotation.set(0, 0, 0);
  pack.rotation.set(0, 0, 0);
  c.tool.visible = mode === 'work';
  c.arc.scale.setScalar(0.001);
  if (mode === 'idle') {
    const b = sin(t * 1.9);
    torso.scale.set(1 + 0.008 * b, 1 + 0.02 * b, 1);
    hips.position.y += 0.004 * b;
    hips.rotation.z = 0.02 * sin(t * 0.6);
    torso.rotation.set(c.lean, 0.08, -0.03);
    head.rotation.set(0.03 * b - c.lean * 0.6, 0.2 * sin(t * 0.6), 0.03);
    shL.rotation.x = 0.05 + 0.04 * b;
    shR.rotation.x = 0.05 - 0.04 * b;
    shL.rotation.z = -0.1;
    shR.rotation.z = 0.1;
    elL.rotation.x = -0.28;
    elR.rotation.x = -0.35;
    pack.rotation.x = 0.02 * b;
    hipL.rotation.set(0, 0, 0);
    hipR.rotation.set(0, 0, 0);
    knL.rotation.x = knR.rotation.x = 0;
  } else if (mode === 'walk') {
    const ph = t * 7;
    const f = sin(ph);
    hips.position.y += 0.034 * Math.abs(Math.cos(ph)) - 0.014;
    hips.rotation.y = 0.12 * f;
    torso.rotation.set(0.08 + c.lean, -0.18 * f, 0.07 * Math.cos(ph));
    hipL.rotation.x = -0.7 * f;
    hipR.rotation.x = 0.7 * f;
    knL.rotation.x = 0.12 + 0.85 * Math.max(0, Math.cos(ph));
    knR.rotation.x = 0.12 + 0.85 * Math.max(0, -Math.cos(ph));
    shL.rotation.set(0.6 * f, 0, -0.08 - 0.1 * Math.cos(ph));
    shR.rotation.set(-0.6 * f, 0, 0.08 - 0.1 * Math.cos(ph));
    elL.rotation.x = -0.3 - 0.25 * Math.max(0, -f);
    elR.rotation.x = -0.3 - 0.25 * Math.max(0, f);
    head.rotation.y = 0.1 * f;
    pack.rotation.x = 0.04 * Math.cos(ph * 2);
  } else {
    const w = t * 9;
    const s = sin(w);
    hips.position.y -= 0.05;
    hipL.rotation.x = -0.35;
    hipR.rotation.x = -0.1;
    knL.rotation.x = 0.55;
    knR.rotation.x = 0.35;
    torso.rotation.set(0.22, 0.12, 0);
    head.rotation.set(0.15, -0.1, 0);
    shR.rotation.set(-1.15 + 0.55 * s, 0, 0.05);
    elR.rotation.x = -0.9 + 0.45 * s;
    shL.rotation.set(-1.1, 0, -0.1);
    elL.rotation.x = -0.45 + 0.03 * sin(t * 31);
    c.arc.scale.setScalar(0.4 + 0.9 * Math.abs(sin(t * 43) * sin(t * 17)));
  }
}

/** Orange sparks thrown from the welding hand. World space, recycled pool. */
export class Sparks {
  readonly group = new Group();
  private readonly ps: { m: Mesh; v: Vector3; life: number }[] = [];
  constructor() {
    const mat = new MeshBasicMaterial({ color: 0xff7a1a, toneMapped: false });
    mat.color.multiplyScalar(2);
    const geo = new BoxGeometry(0.025, 0.025, 0.025);
    for (let i = 0; i < 40; i++) {
      const m = new Mesh(geo, mat);
      m.visible = false;
      this.group.add(m);
      this.ps.push({ m, v: new Vector3(), life: 0 });
    }
  }
  emit(at: Vector3): void {
    const p = this.ps.find((q) => q.life <= 0);
    if (!p) return;
    p.life = 0.35 + Math.random() * 0.3;
    p.m.position.copy(at);
    p.v.set((Math.random() - 0.5) * 1.4, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.4);
    p.m.visible = true;
  }
  update(dt: number): void {
    for (const p of this.ps) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= 5 * dt;
      p.m.position.addScaledVector(p.v, dt);
      if (p.life <= 0 || p.m.position.y < 0) {
        p.life = 0;
        p.m.visible = false;
      }
    }
  }
}
