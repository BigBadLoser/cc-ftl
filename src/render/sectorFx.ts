import { Graphics, Sprite, Text } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { GridLike } from '../sim/grid';
import type { SimEvent } from '../sim/events';
import { ALT, BodyC } from '../sim/body';
import { ModuleC } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import { CombatC, ProjectileC, ShipC, type Ship } from '../sim/combat/components';
import type { ModuleDef, ShotLook, WeaponDef } from '../sim/registry';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { IMPACT_H, MUZZLE_H, Z_PX } from './heights';
import { ART_SCALE as S } from './iso';
import { sectorArt } from './sectorPos';
import type { Layers } from './layers';
import type { EmitterDef, Particles } from './fx/particles';
import { onShip } from './regionRules';
import { animNow } from './animClock';
import { createShieldView } from './shieldView';
import { ARC_COLOR, drawBolt, shotLook } from './shotLook';

export interface SectorFx {
  onEvents(events: readonly SimEvent[]): void;
  update(dt: number, alpha: number): void;
  dispose(): void;
}

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
  /** A lightning arc (zigzag, tinted) instead of a point-defence line. */
  arc?: number;
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
  hull: (ship: number) => GridLike | undefined = () => undefined,
): SectorFx {
  const shots = new Map<number, { spr: Sprite; x: number; y: number; from: { x: number; y: number } }>();
  const shields = createShieldView(world, atlas, { dome: L.fx, add: L.fxAdd }, hull);
  /** Render hints of the shots in flight (a fitted upgrade's tint, blast and trail), from the firing event. */
  const looks = new Map<number, ShotLook>();
  const flashes: Flash[] = [];
  const tracers: Tracer[] = [];
  const floaters: Floater[] = [];
  const lines = new Graphics();
  L.ui.addChild(lines);

  const shipAtTile = (at: { x: number; y: number }): Ship | undefined => {
    for (const id of world.query(ShipC)) {
      const s = world.get(id, ShipC);
      if (s && onShip(s, at)) return s;
    }
    return undefined;
  };
  const ship = (id: number): Ship | undefined => world.get(id, ShipC);
  /** Sector point (tile units, a tile's centre is at +0.5) -> art px in the sector frame. */
  const secArt = sectorArt;
  /** Centre of sector tile (x, y). */
  const tileArt = (x: number, y: number) => secArt(x + 0.5, y + 0.5);
  /** Where a drone's gun is (its body, lifted by its altitude), in art px; null when it is gone. Tracers end 6 S px under their point. */
  const droneMuzzle = (id: number): { x: number; y: number } | null => {
    const b = world.get(id, BodyC);
    if (!b) return null;
    const p = secArt(b.x, b.y);
    return { x: p.x, y: p.y - b.alt * Z_PX + 10 * S };
  };

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

  function say(text: string, sx: number, sy: number, fill: number): void {
    const p = secArt(sx, sy);
    const t = new Text({
      text, resolution: Math.max(1, L.scale),
      style: { fontFamily: 'monospace', fontSize: 12 * S, fontWeight: 'bold', fill, stroke: { color: 0x05080d, width: 2 * S } },
    });
    t.anchor.set(0.5);
    t.position.set(Math.round(p.x), Math.round(p.y - 14 * S));
    L.ui.addChild(t);
    floaters.push({ text: t, age: 0, y0: t.y });
  }

  return {
    onEvents(events) {
      for (const e of events) {
        if (e.type === 'weapon.fired') {
          const m = world.get(e.weaponId, ModuleC);
          const def = m && content.modules[m.def];
          const s = m && shipAtTile(m);
          if (!m || !def || !s) continue;
          const [w, h] = rotatedSize(def, m.rot);
          const c = secArt(m.x + w / 2, m.y + h / 2);
          if (e.look) looks.set(e.projectile, e.look);
          particles.burst(burst(shotLook(e.weapon, e.look).tint, 60), c.x, c.y - MUZZLE_H, 8, 6);
          flash('fx.pd_shot', c.x, c.y - MUZZLE_H, 2);
        } else if (e.type === 'projectile.shieldHit') {
          const drain = content.weapons[e.weapon]?.effects.some((f) => f.type === 'shieldDrain');
          shields.hit(e.ship, drain ? 'ion' : 'absorb', shots.get(e.projectile)?.from);
        } else if (e.type === 'projectile.hit') {
          const s = ship(e.ship);
          if (!s) continue;
          const c = tileArt(e.x, e.y);
          const { tint: col, blast: k } = shotLook(e.weapon, looks.get(e.projectile));
          // A shot that reached the hull through raised shields without bypassing them tore through a layer (mass driver).
          const w = content.weapons[e.weapon];
          if (w && !w.shield.bypass && (world.get(e.ship, CombatC)?.shield.layers ?? 0) > 0) shields.hit(e.ship, 'pierce', shots.get(e.projectile)?.from);
          particles.burst(burst(col, 90 * Math.sqrt(k)), c.x, c.y - 10 * S, Math.round(14 * k), 8 * k);
          particles.burst(burst(0xffffff, 60), c.x, c.y - 10 * S, Math.round(6 * k), 6 * k);
          flash('fx.explosion_small', c.x, c.y - 10 * S, k);
        } else if (e.type === 'projectile.arc') {
          tracers.push({ a: tileArt(e.x, e.y), b: tileArt(e.tx, e.ty), age: 0, arc: looks.get(e.projectile)?.tint ?? ARC_COLOR });
        } else if (e.type === 'ship.blast') {
          // A blast aboard (a scene's reactor): the impact explosion, scaled up, with a ring of smaller ones around it.
          const c = secArt(e.x, e.y);
          particles.burst(burst(0xffb060, 140), c.x, c.y - 10 * S, 40, 14);
          particles.burst(burst(0xffffff, 90), c.x, c.y - 10 * S, 16, 10);
          flash('fx.explosion_small', c.x, c.y - 10 * S, 3);
          const r = Math.max(1, e.radius);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const p = secArt(e.x + (dx * r) / 2, e.y + (dy * r) / 2);
            flash('fx.explosion_small', p.x, p.y - 10 * S, 1.4);
          }
        } else if (e.type === 'projectile.intercepted') {
          const s = ship(e.ship);
          const last = shots.get(e.projectile);
          if (!s || !last) continue;
          // From the defence drone that shot it, else from the ship's middle (its point defence).
          const drone = e.by ? droneMuzzle(e.by) : null;
          const from = drone ?? secArt(s.x + s.width / 2, s.y + s.height / 2);
          // A drone's shot meets the missile where it is drawn (lifted on its arc); point defence keeps its ground tracer.
          const at = drone ? { x: last.spr.x, y: last.spr.y + 6 * S } : { x: last.x, y: last.y };
          tracers.push({ a: from, b: at, age: 0 });
          particles.burst(burst(0xffffff, 70), at.x, at.y, 10, 6);
          flash('fx.explosion_small', at.x, at.y, 0.6);
        } else if (e.type === 'drone.fired') {
          // A defence drone's shot at an enemy drone or shuttle (or a miss at a missile): a tracer to the aim point at cruise height.
          const from = droneMuzzle(e.drone);
          const to = secArt(e.x, e.y);
          if (!from) continue;
          const b = { x: to.x, y: to.y - ALT.cruise * Z_PX + 6 * S };
          tracers.push({ a: from, b, age: 0 });
          if (e.hit) flash('fx.pd_shot', b.x, b.y - 6 * S, 1);
        } else if (e.type === 'drone.wrecked' && e.space) {
          const c = tileArt(e.x, e.y);
          const y = c.y - ALT.cruise * Z_PX;
          particles.burst(burst(0xffb060, 80), c.x, y, 12, 7);
          flash('fx.explosion_small', c.x, y, 0.8);
        } else if (e.type === 'projectile.miss') {
          if (e.reason === 'evaded') say('EVADED', e.x, e.y, 0x7fe6ff);
          else if (e.reason === 'space') say('MISS', e.x, e.y, 0xffc83d);
        }
      }
    },
    update(dt, alpha) {
      shields.update(dt, animNow());
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
          spr.tint = looks.get(id)?.tint ?? art.tint;
          spr.blendMode = 'add';
          L.sorted.addChild(spr);
          shots.set(id, (sh = { spr, x: a.x, y: a.y, from: secArt(p.x0, p.y0) }));
        }
        sh.x = a.x;
        sh.y = a.y;
        // From the roof turret down to the target's floor level.
        const h = MUZZLE_H + (IMPACT_H - MUZZLE_H) * t;
        sh.spr.position.set(Math.round(a.x), Math.round(a.y - h));
        const look = shotLook(p.weapon, looks.get(id));
        particles.emit(`pj${id}`, trail(look.tint), a.x, a.y - h, 90 * look.trail, dt, 3);
      }
      for (const [id, sh] of shots) {
        if (seen.has(id)) continue;
        sh.spr.destroy();
        shots.delete(id);
      }
      for (const id of looks.keys()) if (!seen.has(id) && !shots.has(id)) looks.delete(id);
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
        if (tr.arc !== undefined) {
          drawBolt(lines, tr.a, tr.b, tr.arc, a);
          continue;
        }
        lines.moveTo(tr.a.x, tr.a.y - 10 * S).lineTo(tr.b.x, tr.b.y - 6 * S).stroke({ width: 1, color: 0xffffff, alpha: a, pixelLine: true });
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i] as Floater;
        f.age += dt;
        if (f.age >= TEXT_LIFE) {
          f.text.destroy();
          floaters.splice(i, 1);
          continue;
        }
        f.text.y = Math.round(f.y0 - 16 * S * (f.age / TEXT_LIFE));
        f.text.alpha = Math.min(1, (1 - f.age / TEXT_LIFE) * 2);
      }
    },
    dispose() {
      shields.dispose();
      for (const s of shots.values()) s.spr.destroy();
      for (const f of flashes) f.spr.destroy();
      for (const f of floaters) f.text.destroy();
      shots.clear();
      looks.clear();
      flashes.length = floaters.length = tracers.length = 0;
      lines.destroy();
    },
  };
}
