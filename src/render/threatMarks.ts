import { rotatedSize } from '../sim/modules/footprint';
import { ModuleC } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { Container, Graphics, Text } from 'pixi.js';
import { ProjectileC, ShipC, WeaponC } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { WeaponDef } from '../sim/registry';
import { TICK_HZ } from '../sim/time';
import { ROOF_H } from './heights';
import { footprintQuad, padQuad, type Seg } from './targetBrackets';

const C_THREAT = 0xff5a5a;
/** Bracket stroke width in sector-layer units (about 4 screen px at the default fight framing, scale 0.375), and its floor in screen px when zoomed far out. */
const STROKE_W = 10.7;
const MIN_STROKE_PX = 1.5;
const C_OUTLINE = 0x05080d;

export interface ThreatMarksHost {
  world: World;
  weapons: Readonly<Record<string, WeaponDef>>;
  modules: Readonly<Record<string, ModuleDef>>;
  /** The camera ship (the player's): whose incoming fire is drawn. */
  refId(): number;
  roofed(shipId: number): boolean;
  scale(): number;
  /** Seconds until a weapon's committed shot lands (charge left plus flight), or null. */
  commitEta(weaponId: number): number | null;
}

/** One incoming shot or committed aim: the aim area (module footprint or one tile), the scatter radius in tiles, and how much of the countdown is left (1 = just committed, 0 = lands). */
interface Threat {
  key: number;
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
  left: number;
  flying: boolean;
  /** Seconds to impact. */
  eta: number;
}

export interface ThreatMarks {
  update(): void;
}

/**
 * PLACEHOLDER debug-style overlay: the aim an enemy weapon committed on the player's ship (a red bracket over the scatter area, with a shrinking
 * countdown ring), kept by its shots until they land. One marker per weapon. Reads the sim only.
 */
export function createThreatMarks(host: ThreatMarksHost, parent: Container): ThreatMarks {
  const gfx = new Graphics();
  parent.addChild(gfx);
  /** One countdown label per weapon, reused frame to frame. */
  const labels = new Map<number, Text>();
  const label = (key: number): Text => {
    let t = labels.get(key);
    if (!t) {
      t = new Text({ text: '', style: { fontFamily: 'Rajdhani, Arial Narrow, sans-serif', fontWeight: '700', fontSize: 15, fill: 0xff8a8a, stroke: { color: 0x05080d, width: 4 } }, resolution: 2 });
      t.anchor.set(0, 0.5);
      parent.addChild(t);
      labels.set(key, t);
    }
    return t;
  };

  /** Aim area of a shot in flight: its target module's footprint, else the tile it flies to. */
  function rectOf(p: { target: { moduleId: number; ship: number }; x1: number; y1: number }): { x: number; y: number; w: number; h: number } {
    const m = p.target.moduleId ? host.world.get(p.target.moduleId, ModuleC) : undefined;
    const def = m && host.modules[m.def];
    if (m && def) {
      const [w, h] = rotatedSize(def, m.rot);
      return { x: m.x, y: m.y, w, h };
    }
    return { x: Math.floor(p.x1), y: Math.floor(p.y1), w: 1, h: 1 };
  }

  function threats(ref: number): Threat[] {
    const out = new Map<number, Threat>();
    const radius = (weapon: string): number => Math.max(1, Math.round(host.weapons[weapon]?.spread ?? 1));
    for (const id of host.world.query(WeaponC)) {
      const w = host.world.get(id, WeaponC);
      const c = w?.commit;
      if (!w || !c || c.target.ship !== ref) continue;
      const r = radius(host.modules[host.world.get(id, ModuleC)?.def ?? '']?.weapon ?? '');
      out.set(id, { key: id, x: c.x, y: c.y, w: c.w, h: c.h, radius: r, left: 1 - Math.max(0, Math.min(1, (w.charge - c.from) / Math.max(1e-6, 1 - c.from))), flying: false, eta: host.commitEta(id) ?? 0 });
    }
    for (const id of host.world.query(ProjectileC)) {
      const p = host.world.get(id, ProjectileC);
      if (!p || p.target.ship !== ref || p.target.vehicle) continue;
      const left = 1 - Math.min(1, p.t);
      const prev = out.get(p.fromModuleId);
      if (!prev || prev.left > left) out.set(p.fromModuleId, { key: p.fromModuleId, ...rectOf(p), radius: radius(p.weapon), left, flying: true, eta: Math.max(0, (1 - p.t) / Math.max(1e-6, p.dt) / TICK_HZ) });
    }
    return [...out.values()];
  }

  return {
    update() {
      gfx.clear();
      const used = new Set<number>();
      const done = () => { for (const [k, t] of labels) t.visible = used.has(k); };
      const ref = host.refId();
      if (!host.world.get(ref, ShipC)) return done();
      const s = host.scale();
      const lift = host.roofed(ref) ? ROOF_H : 0;
      const px = (n: number) => n / s;
      const now = performance.now();
      // Weapons aimed at the same area alternate the mark: even ones hug the iso footprint, odd ones are the same bracket turned 90 degrees about its centre (corners at the midpoints of the first one's sides); a third and later get a few px more room.
      const seen = new Map<string, number>();
      for (const t of threats(ref).sort((a, b) => a.key - b.key)) {
        const area = `${t.x},${t.y},${t.w},${t.h}`;
        const nth = seen.get(area) ?? 0;
        seen.set(area, nth + 1);
        const turned = nth % 2 === 1;
        const extra = 2 + 3 * Math.floor(nth / 2);
        const project = (ax: number, ay: number) => ({ x: ax * s, y: ay * s });
        const r = t.radius;
        const quad = footprintQuad(t.x - r, t.y - r, t.w + 2 * r, t.h + 2 * r, { x: 0, y: 0 }, lift, project, 0);
        const pulse = t.flying ? 1 : 0.7 + 0.3 * Math.sin(now / (60 + 240 * t.left));
        const segs = turned ? turnedSegments(padQuad(quad, extra)) : cornerSegments(padQuad(quad, extra));
        // One steady stroke (no outline pass, no pulse), its width in world space like the arms, so it grows and shrinks with the camera.
        for (const sg of segs) gfx.moveTo(px(sg.x1), px(sg.y1)).lineTo(px(sg.x2), px(sg.y2));
        gfx.stroke({ width: Math.max(STROKE_W, px(MIN_STROKE_PX)), color: C_THREAT, alpha: 1, cap: 'butt' });
        // Countdown ring on the aim area: a squashed (iso) circle whose lit arc shrinks to nothing as the shot comes.
        const c = footprintQuad(t.x, t.y, t.w, t.h, { x: 0, y: 0 }, lift, project, 0);
        const cx = px((c.left.x + c.right.x) / 2);
        const cy = px((c.top.y + c.bottom.y) / 2);
        const rx = (turned ? 1.18 : 1) * Math.min(px((c.right.x - c.left.x) / 2), px(footprintQuad(0, 0, 2, 2, { x: 0, y: 0 }, 0, project, 0).right.x) ) * 0.8;
        const ry = rx / 2;
        gfx.ellipse(cx, cy, rx, ry).stroke({ width: px(6), color: C_OUTLINE, alpha: 0.8 });
        gfx.ellipse(cx, cy, rx, ry).stroke({ width: px(3), color: C_THREAT, alpha: 0.4 });
        if (t.left > 0.01) {
          const n = Math.max(2, Math.ceil(t.left * 32));
          for (let i = 0; i <= n; i++) {
            const a = -Math.PI / 2 + (i / 32) * 2 * Math.PI;
            const X = cx + Math.cos(a) * rx;
            const Y = cy + Math.sin(a) * ry;
            if (i === 0) gfx.moveTo(X, Y);
            else gfx.lineTo(X, Y);
          }
          gfx.stroke({ width: px(6), color: 0xff8a8a, alpha: Math.max(0.85, pulse), cap: 'butt' });
        }
        gfx.circle(cx, cy, px(2)).fill({ color: C_THREAT, alpha: pulse });
        // Seconds to impact, beside the ring: always the same size on screen, whatever the camera.
        const tx = label(t.key);
        tx.text = `${t.eta.toFixed(1)}s`;
        tx.scale.set(px(1));
        tx.position.set(cx + rx + px(6), cy);
        used.add(t.key);
      }
      done();
    },
  };
}

type Pt = { x: number; y: number };
type Quad4 = { top: Pt; right: Pt; bottom: Pt; left: Pt };

/** Arm length as a share of the side it runs along: the arms are sized in world space, so they scale with zoom like the ring. */
const ARM_SHARE = 0.15;

function armsAt(p: Pt, a: Pt, b: Pt, out: Seg[], k: number): void {
  for (const o of [a, b]) {
    out.push({ x1: p.x, y1: p.y, x2: p.x + (o.x - p.x) * k, y2: p.y + (o.y - p.y) * k });
  }
}

/** Corner brackets of the iso footprint: at each vertex, two arms along the edges that meet there, each ARM_SHARE of the edge. */
function cornerSegments(q: Quad4, k = ARM_SHARE): Seg[] {
  const v = [q.top, q.right, q.bottom, q.left] as const;
  const out: Seg[] = [];
  for (let i = 0; i < 4; i++) armsAt(v[i] as Pt, v[(i + 1) % 4] as Pt, v[(i + 3) % 4] as Pt, out, k);
  return out;
}

/** The same bracket turned 90 degrees about the footprint's centre: its corners sit at the midpoints of the first mark's sides. */
function turnedSegments(q: Quad4): Seg[] {
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  return cornerSegments({ top: mid(q.left, q.top), right: mid(q.top, q.right), bottom: mid(q.right, q.bottom), left: mid(q.bottom, q.left) }, ARM_SHARE * Math.SQRT2); // its sides are 1/sqrt2 as long: same arm length as the first mark
}
