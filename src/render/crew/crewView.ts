import {
  CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, RingGeometry, Box3, Vector3, type Raycaster,
} from 'three';
import type { World } from '../../sim/ecs';
import { CrewC, DraftedC, PositionC } from '../../sim/crew/components';
import { disposeCrewAssets, generateCrew, type CrewModel } from './generator';

export interface CrewViewHost {
  /** Offset of tile (0,0)'s min corner in world space, and the grid being shown; null when nothing is shown. */
  target(): { offsetX: number; offsetZ: number; gridId: number } | null;
}

export interface CrewView {
  group: Group;
  update(alpha: number): void;
  setSelectedCrew(id: number | null): void;
  /** Nearest crew entity hit by the ray, or null. */
  pick(ray: Raycaster): number | null;
  dispose(): void;
}

interface Slot {
  model: CrewModel;
  root: Group;
  figure: Group;
  ring: Mesh;
  x: number;
  z: number;
  yaw: number;
  phase: number;
  walk: number;
  work: number;
  lie: number;
  placed: boolean;
}

const shadowTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const q = g.createRadialGradient(32, 32, 4, 32, 32, 32);
    q.addColorStop(0, 'rgba(0,0,0,.6)');
    q.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = q;
    g.fillRect(0, 0, 64, 64);
  }
  return new CanvasTexture(c);
})();
const shadowMat = new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false });
const shadowGeo = new PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
const ringGeo = new RingGeometry(0.3, 0.37, 24).rotateX(-Math.PI / 2);
const ringMat = (c: number) => {
  const m = new MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.9, depthWrite: false, side: DoubleSide });
  return m;
};
const cyanRing = ringMat(0x22d3ee);
const redRing = ringMat(0xff3b3b);

const angDiff = (a: number, b: number): number => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function createCrewView(world: World, host: CrewViewHost): CrewView {
  const group = new Group();
  const slots = new Map<number, Slot>();
  let selected: number | null = null;
  let last = performance.now();
  let time = 0;

  function make(id: number): Slot | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    const model = generateCrew(crew);
    const root = new Group();
    const figure = new Group();
    figure.add(model.group);
    root.add(figure);
    const shadow = new Mesh(shadowGeo, shadowMat);
    shadow.position.y = 0.02;
    shadow.renderOrder = 1;
    const ring = new Mesh(ringGeo, redRing);
    ring.position.y = 0.04;
    ring.renderOrder = 2;
    root.add(shadow, ring);
    group.add(root);
    return { model, root, figure, ring, x: 0, z: 0, yaw: 0, phase: Math.random() * 6, walk: 0, work: 0, lie: 0, placed: false };
  }

  function animate(s: Slot, activity: string, speed: number, dt: number): void {
    const m = s.model;
    const k = 1 - Math.exp(-dt * 10);
    const moving = speed > 0.3 && activity !== 'sleeping';
    s.walk = lerp(s.walk, moving ? 1 : 0, k);
    s.work = lerp(s.work, activity === 'working' && !moving ? 1 : 0, k);
    s.lie = lerp(s.lie, activity === 'sleeping' ? 1 : 0, 1 - Math.exp(-dt * 6));
    s.phase += dt * (6 + Math.min(speed, 4) * 1.5) * s.walk;
    const w = s.walk;
    const sn = Math.sin(s.phase);
    const cs = Math.cos(s.phase);
    const breathe = Math.sin(time * 1.8) * 0.012;
    const hit = Math.sin(time * 9) * 0.5 + 0.5;
    const idleArm = 0.05 + breathe;
    m.legL.rotation.x = -sn * 0.7 * w;
    m.legR.rotation.x = sn * 0.7 * w;
    m.kneeL.rotation.x = Math.max(0, cs) * 0.9 * w;
    m.kneeR.rotation.x = Math.max(0, -cs) * 0.9 * w;
    const armSwing = (sn: number, swing: number) => lerp(swing * 0.55 * w, -1.1 - hit * 0.6, s.work);
    m.armL.rotation.x = armSwing(sn, sn);
    m.armR.rotation.x = armSwing(sn, -sn);
    m.armL.rotation.z = idleArm;
    m.armR.rotation.z = -idleArm;
    m.elbowL.rotation.x = -0.2 - 0.3 * w - s.work * 0.5;
    m.elbowR.rotation.x = -0.2 - 0.3 * w - s.work * 0.5;
    m.torso.rotation.x = s.work * (0.18 + hit * 0.08);
    m.torso.rotation.y = sn * 0.12 * w;
    m.head.rotation.y = -sn * 0.06 * w + Math.sin(time * 0.7 + s.phase) * 0.12 * (1 - w);
    m.head.rotation.x = -s.work * 0.1;
    m.hips.position.y = 0.8 + Math.abs(cs) * 0.035 * w + breathe * (1 - w);
    s.figure.rotation.x = -s.lie * Math.PI / 2;
    s.figure.position.set(0, s.lie * 0.13, s.lie * 0.8);
  }

  function update(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    time += dt;
    const t = host.target();
    group.visible = t !== null;
    if (!t) return;
    group.position.set(t.offsetX, 0, t.offsetZ);
    const seen = new Set<number>();
    for (const id of world.query(CrewC, PositionC)) {
      const pos = world.get(id, PositionC);
      const crew = world.get(id, CrewC);
      if (!pos || !crew || pos.gridId !== t.gridId) continue;
      seen.add(id);
      let s = slots.get(id);
      if (!s) {
        const made = make(id);
        if (!made) continue;
        slots.set(id, (s = made));
      }
      const tx = lerp(pos.x, pos.toX, pos.progress) + 0.5;
      const tz = lerp(pos.y, pos.toY, pos.progress) + 0.5;
      const dx = tx - s.x;
      const dz = tz - s.z;
      const dist = Math.hypot(dx, dz);
      if (!s.placed || dist > 3) {
        s.x = tx;
        s.z = tz;
        s.placed = true;
        s.yaw = Math.atan2(Math.cos((pos.facing * Math.PI) / 4), Math.sin((pos.facing * Math.PI) / 4));
      } else {
        const k = 1 - Math.exp(-dt * 14);
        s.x += dx * k;
        s.z += dz * k;
      }
      const speed = dt > 0 ? (dist * (1 - Math.exp(-dt * 14))) / dt : 0;
      const fa = (pos.facing * Math.PI) / 4; // grid angle: 0 = +x, 2 = +y (world +z)
      const targetYaw = Math.atan2(Math.cos(fa), Math.sin(fa)); // model front is +z
      s.yaw += angDiff(s.yaw, targetYaw) * (1 - Math.exp(-dt * 12));
      s.root.position.set(s.x, 0, s.z);
      s.root.rotation.y = s.yaw;
      const drafted = world.has(id, DraftedC) || crew.activity === 'drafted';
      s.ring.visible = drafted || id === selected;
      s.ring.material = id === selected ? cyanRing : redRing;
      animate(s, crew.activity, speed, dt);
    }
    for (const [id, s] of slots) {
      if (seen.has(id)) continue;
      group.remove(s.root);
      slots.delete(id);
    }
  }

  const box = new Box3();
  const hitPt = new Vector3();
  return {
    group,
    update,
    setSelectedCrew(id) {
      selected = id;
    },
    pick(ray) {
      let best: number | null = null;
      let bestD = Infinity;
      for (const [id, s] of slots) {
        const p = s.root.position;
        const lying = s.lie > 0.5;
        box.min.set(p.x - (lying ? 0.5 : 0.28), 0, p.z - (lying ? 0.5 : 0.28));
        box.max.set(p.x + (lying ? 0.5 : 0.28), lying ? 0.35 : 1.7, p.z + (lying ? 0.5 : 0.28));
        box.translate(group.position);
        if (ray.ray.intersectBox(box, hitPt)) {
          const d = hitPt.distanceTo(ray.ray.origin);
          if (d < bestD) {
            bestD = d;
            best = id;
          }
        }
      }
      return best;
    },
    dispose() {
      slots.clear();
      group.clear();
      disposeCrewAssets();
    },
  };
}
