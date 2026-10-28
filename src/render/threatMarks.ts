import { rotatedSize } from '../sim/modules/footprint';
import { ModuleC } from '../sim/modules/components';
import type { ModuleDef } from '../sim/registry';
import { Container, Graphics } from 'pixi.js';
import { ProjectileC, ShipC, WeaponC } from '../sim/combat/components';
import type { World } from '../sim/ecs';
import type { WeaponDef } from '../sim/registry';
import { ROOF_H } from './heights';
import { footprintQuad, isoBracketSegments, padQuad } from './targetBrackets';

const C_THREAT = 0xff5a5a;
const C_OUTLINE = 0x05080d;

export interface ThreatMarksHost {
  world: World;
  weapons: Readonly<Record<string, WeaponDef>>;
  modules: Readonly<Record<string, ModuleDef>>;
  /** The camera ship (the player's): whose incoming fire is drawn. */
  refId(): number;
  roofed(shipId: number): boolean;
  scale(): number;
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
      out.set(id, { key: id, x: c.x, y: c.y, w: c.w, h: c.h, radius: r, left: 1 - Math.max(0, Math.min(1, (w.charge - c.from) / Math.max(1e-6, 1 - c.from))), flying: false });
    }
    for (const id of host.world.query(ProjectileC)) {
      const p = host.world.get(id, ProjectileC);
      if (!p || p.target.ship !== ref || p.target.vehicle) continue;
      const left = 1 - Math.min(1, p.t);
      const prev = out.get(p.fromModuleId);
      if (!prev || prev.left > left) out.set(p.fromModuleId, { key: p.fromModuleId, ...rectOf(p), radius: radius(p.weapon), left, flying: true });
    }
    return [...out.values()];
  }

  return {
    update() {
      gfx.clear();
      const ref = host.refId();
      if (!host.world.get(ref, ShipC)) return;
      const s = host.scale();
      const lift = host.roofed(ref) ? ROOF_H : 0;
      const px = (n: number) => n / s;
      const now = performance.now();
      for (const t of threats(ref)) {
        const project = (ax: number, ay: number) => ({ x: ax * s, y: ay * s });
        const r = t.radius;
        const quad = footprintQuad(t.x - r, t.y - r, t.w + 2 * r, t.h + 2 * r, { x: 0, y: 0 }, lift, project, 0);
        const pulse = t.flying ? 1 : 0.7 + 0.3 * Math.sin(now / (60 + 240 * t.left));
        for (const sg of isoBracketSegments(padQuad(quad, 2))) gfx.moveTo(px(sg.x1), px(sg.y1)).lineTo(px(sg.x2), px(sg.y2));
        gfx.stroke({ width: px(6), color: C_OUTLINE, alpha: 0.85, cap: 'square' });
        for (const sg of isoBracketSegments(padQuad(quad, 2))) gfx.moveTo(px(sg.x1), px(sg.y1)).lineTo(px(sg.x2), px(sg.y2));
        gfx.stroke({ width: px(3), color: C_THREAT, alpha: pulse, cap: 'square' });
        // Countdown ring on the aim area: a squashed (iso) circle whose lit arc shrinks to nothing as the shot comes.
        const c = footprintQuad(t.x, t.y, t.w, t.h, { x: 0, y: 0 }, lift, project, 0);
        const cx = px((c.left.x + c.right.x) / 2);
        const cy = px((c.top.y + c.bottom.y) / 2);
        const rx = Math.min(px((c.right.x - c.left.x) / 2), px(footprintQuad(0, 0, 2, 2, { x: 0, y: 0 }, 0, project, 0).right.x) ) * 0.8;
        const ry = rx / 2;
        gfx.ellipse(cx, cy, rx, ry).stroke({ width: px(4), color: C_OUTLINE, alpha: 0.7 });
        gfx.ellipse(cx, cy, rx, ry).stroke({ width: px(2), color: C_THREAT, alpha: 0.35 });
        if (t.left > 0.01) {
          const n = Math.max(2, Math.ceil(t.left * 32));
          for (let i = 0; i <= n; i++) {
            const a = -Math.PI / 2 + (i / 32) * 2 * Math.PI;
            const X = cx + Math.cos(a) * rx;
            const Y = cy + Math.sin(a) * ry;
            if (i === 0) gfx.moveTo(X, Y);
            else gfx.lineTo(X, Y);
          }
          gfx.stroke({ width: px(4), color: C_THREAT, alpha: pulse, cap: 'butt' });
        }
        gfx.circle(cx, cy, px(2)).fill({ color: C_THREAT, alpha: pulse });
      }
    },
  };
}
