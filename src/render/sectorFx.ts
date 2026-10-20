import { Graphics, Sprite, Text } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { SimEvent } from '../sim/events';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import { ProjectileC, ShipC, type Ship } from '../sim/combat/components';
import type { ModuleDef, WeaponDef } from '../sim/registry';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { IMPACT_H, MUZZLE_H } from './heights';
import { sectorArt } from './sectorPos';
import type { Layers } from './layers';
import type { EmitterDef, Particles } from './fx/particles';

export interface SectorFx {
  onEvents(events: readonly SimEvent[]): void;
  update(dt: number, alpha: number): void;
  dispose(): void;
}

/** Colour per weapon def id for trails, flashes and sparks. */
const WEAPON_COLOR: Readonly<Record<string, number>> = {
  'weapon.burstLaser': 0xff5a4a, 'weapon.massDriver': 0xffd27a, 'weapon.missile': 0xffe9c0, 'weapon.ion': 0x66ccff, 'weapon.incendiary': 0xff8a3a,
};
const SHIELD_COLOR = 0x66e0ff;
/** Emitter defs are cached by value: the particle system keeps per-def texture lists. */
const defs = new Map<string, EmitterDef>();
const cached = (key: string, make: () => EmitterDef): EmitterDef => {
  let d = defs.get(key);
  if (!d) defs.set(key, (d = make()));
  return d;
};
const trail = (tint: number): EmitterDef =>
  cached(`t${tint}`, () => ({ frames: ['fx.spark', 'fx.ember'], life: [0.3, 0.6], vx: [-6, 6], vy: [-6, 6], fade: 'out', additive: true, tint, scale: 3 }));
const burst = (tint: number, speed: number): EmitterDef =>
  cached(`b${tint}|${speed}`, () => ({
    frames: ['fx.ember', 'fx.spark'], life: [0.3, 0.7], vx: [-speed, speed], vy: [-speed, speed * 0.3], gy: 60, fade: 'out', additive: true, tint, scale: 2,
  }));

interface Flash {
  spr: Sprite | Graphics;
  age: number;
  life: number;
  grow: number;
  peak: number;
}
interface Tracer {
  a: { x: number; y: number };
  b: { x: number; y: number };
  age: number;
}
interface Floater {
  text: Text;
  age: number;
  y0: number;
}

const FLASH_LIFE = 0.28;
const TEXT_LIFE = 1.1;
const TRACER_LIFE = 0.2;

/**
 * Combat fx in sector space (one layer above all ships): projectiles in flight and their trails, muzzle flashes,
 * shield hit bubbles, explosions, point-defence tracers and MISS/EVADED text. Driven by ProjectileC and sim events;
 * renderer-only, it never writes the sim.
 */
export function createSectorFx(
  world: World, atlas: Atlas, L: Layers, particles: Particles,
  content: { weapons: Readonly<Record<string, WeaponDef>>; modules: Readonly<Record<string, ModuleDef>> },
): SectorFx {
  const shots = new Map<number, { spr: Sprite; x: number; y: number }>();
  const flashes: Flash[] = [];
  const tracers: Tracer[] = [];
  const floaters: Floater[] = [];
  const lines = new Graphics();
  L.ui.addChild(lines);

  const ship = (gridId: number): Ship | undefined => {
    for (const id of world.query(ShipC)) {
      const s = world.get(id, ShipC);
      if (s?.gridId === gridId) return s;
    }
    return undefined;
  };
  /** Sector point (tile units, a tile's centre is at +0.5) -> art px in the sector frame. */
  const secArt = sectorArt;
  /** Centre of sector tile (x, y). */
  const tileArt = (x: number, y: number) => secArt(x + 0.5, y + 0.5);
  const colorOf = (weapon: string) => WEAPON_COLOR[weapon] ?? 0xffffff;

  function flash(assetId: string, x: number, y: number, scale: number, peak = 1): void {
    const art = resolveArt(atlas, [assetId]);
    if (!art) return;
    const spr = new Sprite(art.s.tex);
    spr.blendMode = 'add';
    spr.tint = art.tint;
    spr.anchor.set(art.s.ax / art.s.tex.width, art.s.ay / art.s.tex.height);
    spr.position.set(Math.round(x), Math.round(y));
    spr.scale.set(art.scale * scale);
    L.sorted.addChild(spr);
    flashes.push({ spr, age: 0, life: FLASH_LIFE, grow: 0.8, peak });
  }

  function bubble(s: Ship): void {
    const c = secArt(s.x + s.width / 2, s.y + s.height / 2);
    const k = (s.width + s.height) / 2;
    const rx = (s.width + s.height) * 16 + 10;
    const g = new Graphics();
    g.ellipse(0, 0, rx, rx / 2).stroke({ width: 3, color: 0x9fefff, alpha: 1 });
    g.position.set(Math.round(c.x), Math.round(c.y));
    L.sorted.addChild(g);
    flashes.push({ spr: g, age: 0, life: 0.45, grow: 0, peak: 1 });
    particles.burst(burst(SHIELD_COLOR, 70), c.x, c.y, 10, k * 24);
  }

  function say(text: string, sx: number, sy: number, fill: number): void {
    const p = secArt(sx, sy);
    const t = new Text({
      text, resolution: Math.max(1, L.scale),
      style: { fontFamily: 'monospace', fontSize: 12, fontWeight: 'bold', fill, stroke: { color: 0x05080d, width: 2 } },
    });
    t.anchor.set(0.5);
    t.position.set(Math.round(p.x), Math.round(p.y - 14));
    L.ui.addChild(t);
    floaters.push({ text: t, age: 0, y0: t.y });
  }

  return {
    onEvents(events) {
      for (const e of events) {
        if (e.type === 'weapon.fired') {
          const m = world.get(e.weaponId, ModuleC);
          const def = m && content.modules[m.def];
          const s = m && ship(m.gridId);
          if (!m || !def || !s) continue;
          const [w, h] = rotatedSize(def, m.rot);
          const c = secArt(m.x + w / 2, m.y + h / 2);
          particles.burst(burst(colorOf(e.weapon), 60), c.x, c.y - MUZZLE_H, 8, 6);
          flash('fx.pd_shot', c.x, c.y - MUZZLE_H, 2);
        } else if (e.type === 'projectile.shieldHit') {
          const s = ship(e.gridId);
          if (s) bubble(s);
        } else if (e.type === 'projectile.hit') {
          const s = ship(e.gridId);
          if (!s) continue;
          const c = tileArt(e.x, e.y);
          const col = colorOf(e.weapon);
          particles.burst(burst(col, 90), c.x, c.y - 10, 14, 8);
          particles.burst(burst(0xffffff, 60), c.x, c.y - 10, 6, 6);
          flash('fx.explosion_small', c.x, c.y - 10, 1);
        } else if (e.type === 'projectile.intercepted') {
          const s = ship(e.gridId);
          const last = shots.get(e.projectile);
          if (!s || !last) continue;
          const from = secArt(s.x + s.width / 2, s.y + s.height / 2);
          tracers.push({ a: from, b: { x: last.x, y: last.y }, age: 0 });
          particles.burst(burst(0xffffff, 70), last.x, last.y, 10, 6);
          flash('fx.explosion_small', last.x, last.y, 0.6);
        } else if (e.type === 'projectile.miss') {
          if (e.reason === 'evaded') say('EVADED', e.x, e.y, 0x7fe6ff);
          else if (e.reason === 'space') say('MISS', e.x, e.y, 0xffc83d);
        }
      }
    },
    update(dt, alpha) {
      const seen = new Set<number>();
      for (const id of world.query(ProjectileC)) {
        const p = world.get(id, ProjectileC);
        if (!p) continue;
        seen.add(id);
        const t = Math.min(1, p.t + p.dt * alpha);
        const a = secArt(p.x0 + (p.x1 - p.x0) * t, p.y0 + (p.y1 - p.y0) * t);
        let sh = shots.get(id);
        if (!sh) {
          const art = resolveArt(atlas, [content.weapons[p.weapon]?.projectileAsset ?? 'fx.laser_bolt']);
          if (!art) continue;
          const spr = new Sprite(art.s.tex);
          spr.anchor.set(art.s.ax / art.s.tex.width, art.s.ay / art.s.tex.height);
          spr.scale.set(art.scale);
          spr.tint = art.tint;
          spr.blendMode = 'add';
          L.sorted.addChild(spr);
          shots.set(id, (sh = { spr, x: a.x, y: a.y }));
        }
        sh.x = a.x;
        sh.y = a.y;
        // From the roof turret down to the target's floor level.
        const h = MUZZLE_H + (IMPACT_H - MUZZLE_H) * t;
        sh.spr.position.set(Math.round(a.x), Math.round(a.y - h));
        particles.emit(`pj${id}`, trail(colorOf(p.weapon)), a.x, a.y - h, 90, dt, 3);
      }
      for (const [id, sh] of shots) {
        if (seen.has(id)) continue;
        sh.spr.destroy();
        shots.delete(id);
      }
      for (const f of flashes) {
        f.age += dt;
        const k = Math.min(1, f.age / f.life);
        f.spr.alpha = f.peak * (1 - k);
        if (f.grow) f.spr.scale.set(f.spr.scale.x * (1 + f.grow * dt));
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        if ((flashes[i] as Flash).age < (flashes[i] as Flash).life) continue;
        (flashes[i] as Flash).spr.destroy();
        flashes.splice(i, 1);
      }
      lines.clear();
      for (let i = tracers.length - 1; i >= 0; i--) {
        const tr = tracers[i] as Tracer;
        tr.age += dt;
        if (tr.age >= TRACER_LIFE) {
          tracers.splice(i, 1);
          continue;
        }
        const a = 1 - tr.age / TRACER_LIFE;
        lines.moveTo(tr.a.x, tr.a.y - 10).lineTo(tr.b.x, tr.b.y - 6).stroke({ width: 1, color: 0xffffff, alpha: a, pixelLine: true });
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i] as Floater;
        f.age += dt;
        if (f.age >= TEXT_LIFE) {
          f.text.destroy();
          floaters.splice(i, 1);
          continue;
        }
        f.text.y = Math.round(f.y0 - 16 * (f.age / TEXT_LIFE));
        f.text.alpha = Math.min(1, (1 - f.age / TEXT_LIFE) * 2);
      }
    },
    dispose() {
      for (const s of shots.values()) s.spr.destroy();
      for (const f of flashes) f.spr.destroy();
      for (const f of floaters) f.text.destroy();
      shots.clear();
      flashes.length = floaters.length = tracers.length = 0;
      lines.destroy();
    },
  };
}
