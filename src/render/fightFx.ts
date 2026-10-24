/*
 * PLACEHOLDER ART. Drawn-in-code stand-ins for hand-weapon fire: a tracer line and muzzle flash per shot, a slash for
 * melee, a hit flash with the damage number, and MISS text. Real fx sprites (muzzle, impact, tracer) come later from
 * the sprite pipeline; replace this file then.
 */
import { shipIdAtTile } from './regionRules';
import { Container, Graphics, Text } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { SimEvent } from '../sim/events';
import { PositionC } from '../sim/crew/components';
import { EggSacC } from '../sim/aliens/components';
import { ShipC, type Ship } from '../sim/combat/components';
import { Z_PX } from './heights';
import { ART_SCALE as S, iso, type Pt } from './iso';

export interface FightFxHost {
  ship(shipId: number): Ship | undefined;
  /** Where the crew member's drawn weapon fires from (art px from their feet), or null when no weapon is drawn on them. */
  muzzle?(crew: number): Pt | null;
}

export interface FightFx {
  onEvents(events: readonly SimEvent[]): void;
  update(dt: number): void;
  dispose(): void;
}

const MUZZLE_Z = 0.95;
const BODY_Z = 0.75;
const TRACER_LIFE = 0.32;
const FLASH_LIFE = 0.35;
const TEXT_LIFE = 0.8;

interface Tracer { a: Pt; b: Pt; age: number; ranged: boolean; glob?: boolean; /** Melee slash drawn at `a` (the blade's tip) instead of on the target. */ tip?: boolean }
/** A spitter's glob (natural weapon 'spit'): a slow glowing ball along the line. PLACEHOLDER until a glob sprite exists. */
const GLOB_LIFE = 0.55;
interface Flash { x: number; y: number; age: number; life: number; color: number; r: number }
interface Floater { text: Text; age: number; y0: number }

/** Draws fight feedback in the sector layer. Renderer only: reads events and the world, never writes the sim. */
export function createFightFx(world: World, parent: Container, scale: () => number, host: FightFxHost): FightFx {
  const g = new Graphics();
  parent.addChild(g);
  const tracers: Tracer[] = [];
  const flashes: Flash[] = [];
  const floaters: Floater[] = [];

  /** Sector tile (fractional) on ship `shipId` at height z -> art px in the sector layer's frame (null if the ship is gone). */
  const at = (shipId: number, gx: number, gy: number, z: number): Pt | null => {
    if (!host.ship(shipId)) return null;
    const p = iso(gx, gy);
    return { x: p.x, y: p.y - z * Z_PX };
  };
  const gridOf = (ship: number): number => world.has(ship, ShipC) ? ship : 0;
  const crewAt = (id: number, z: number): Pt | null => {
    const p = world.get(id, PositionC);
    if (p) return at(shipIdAtTile(world, p.x, p.y), p.x + (p.toX - p.x) * p.progress, p.y + (p.toY - p.y) * p.progress, z);
    // Egg sacs have no Position: hit and miss marks go on the sac's centre.
    const sac = world.get(id, EggSacC);
    return sac ? at(sac.ship, sac.x + (sac.size - 1) / 2, sac.y + (sac.size - 1) / 2, z) : null;
  };
  const say = (text: string, p: Pt, fill: number) => {
    const t = new Text({ text, resolution: Math.max(1, scale()), style: { fontFamily: 'monospace', fontSize: 11 * S, fontWeight: 'bold', fill, stroke: { color: 0x05080d, width: 2 * S } } });
    t.anchor.set(0.5);
    t.position.set(Math.round(p.x), Math.round(p.y - 6 * S));
    parent.addChild(t);
    floaters.push({ text: t, age: 0, y0: t.y });
  };

  return {
    onEvents(events) {
      for (const e of events) {
        if (e.type === 'crew.attacked') {
          // From the drawn weapon's muzzle (its tip, for melee) when there is one, else from the crew's chest.
          const feet = at(gridOf(e.ship), e.x, e.y, 0);
          const m = host.muzzle?.(e.crew);
          const a = feet && m ? { x: feet.x + m.x, y: feet.y + m.y } : at(gridOf(e.ship), e.x, e.y, MUZZLE_Z);
          const b = at(gridOf(e.ship), e.tx, e.ty, BODY_Z);
          if (!a || !b) continue;
          const glob = e.weapon === 'spit';
          const tip = !e.ranged && !!m;
          tracers.push({ a, b, age: 0, ranged: e.ranged, glob, tip });
          if (!glob) flashes.push({ x: e.ranged || tip ? a.x : b.x, y: e.ranged || tip ? a.y : b.y, age: 0, life: 0.2, color: 0xfff1a8, r: (e.ranged ? 6 : 8) * S });
        } else if (e.type === 'crew.hit') {
          const p = crewAt(e.target, BODY_Z);
          if (!p) continue;
          flashes.push({ x: p.x, y: p.y, age: 0, life: FLASH_LIFE, color: 0xff4a3a, r: 10 * S });
          say(`-${Math.round(e.damage)}`, p, 0xff8a7a);
        } else if (e.type === 'crew.miss') {
          const p = crewAt(e.target, BODY_Z);
          if (p) say('miss', p, 0xb8c4d6);
        }
      }
    },
    update(dt) {
      g.clear();
      for (let i = tracers.length - 1; i >= 0; i--) {
        const t = tracers[i] as Tracer;
        t.age += dt;
        if (t.age >= (t.glob ? GLOB_LIFE : TRACER_LIFE)) {
          tracers.splice(i, 1);
          continue;
        }
        if (t.glob) {
          const u = t.age / GLOB_LIFE;
          const x = t.a.x + (t.b.x - t.a.x) * u, y = t.a.y + (t.b.y - t.a.y) * u - Math.sin(u * Math.PI) * 10 * S;
          g.circle(x, y, 5 * S).fill({ color: 0xb8e83a, alpha: 0.35 }).circle(x, y, 2.5 * S).fill({ color: 0xeaff9a, alpha: 0.95 });
          continue;
        }
        const k = 1 - t.age / TRACER_LIFE;
        if (t.ranged) g.moveTo(t.a.x, t.a.y).lineTo(t.b.x, t.b.y).stroke({ width: 2 * S, color: 0xffe08a, alpha: k });
        else {
          const c = t.tip ? t.a : t.b;
          g.moveTo(c.x - 8 * S, c.y - 8 * S).lineTo(c.x + 8 * S, c.y + 8 * S).stroke({ width: 2 * S, color: 0xffffff, alpha: k });
        }
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i] as Flash;
        f.age += dt;
        if (f.age >= f.life) {
          flashes.splice(i, 1);
          continue;
        }
        const k = 1 - f.age / f.life;
        g.circle(f.x, f.y, f.r * (1.4 - k * 0.6)).fill({ color: f.color, alpha: 0.85 * k });
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i] as Floater;
        f.age += dt;
        if (f.age >= TEXT_LIFE) {
          f.text.destroy();
          floaters.splice(i, 1);
          continue;
        }
        f.text.y = f.y0 - f.age * 22 * S;
        f.text.alpha = 1 - f.age / TEXT_LIFE;
      }
    },
    dispose() {
      for (const f of floaters) f.text.destroy();
      floaters.length = 0;
      g.destroy();
    },
  };
}
