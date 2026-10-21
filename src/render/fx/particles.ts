import { Particle, ParticleContainer, type Texture } from 'pixi.js';
import type { Atlas } from '../assets/loader';
import type { Layers } from '../layers';
import { ART_SCALE as S } from '../iso';

/** A kind of particle, as data. Velocities are art px per second, gravity in px/s^2 (negative = rises), all authored
 * at the 64 px-tile baseline: the system multiplies them (and `spread`) by ART_SCALE. */
export interface EmitterDef {
  /** Asset ids; with `frameByAge` the frame advances over the particle's life, otherwise one is picked at random. */
  frames: readonly string[];
  frameByAge?: boolean;
  life: readonly [number, number];
  vx: readonly [number, number];
  vy: readonly [number, number];
  gx?: number;
  gy?: number;
  /** Alpha curve: 'out' fades over the whole life, 'inout' fades in over the first fifth and out over the last half. */
  fade: 'out' | 'inout' | 'none';
  /** Peak alpha, default 1. */
  alpha?: number;
  /** Whole-number art scale, default 1. */
  scale?: number;
  tint?: number;
  /** Drawn additively (embers, sparks). */
  additive?: boolean;
}

export const MAX_PARTICLES = 400;

interface Live {
  p: Particle;
  def: EmitterDef;
  tex: Texture[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  add: boolean;
}

const rnd = (r: readonly [number, number]): number => r[0] + Math.random() * (r[1] - r[0]);

/**
 * Small pooled particle system on two Pixi ParticleContainers (normal and additive; all textures come from the one
 * env atlas). Positions snap to whole art pixels, no rotation, integer scale. Renderer-only: it never reads or writes
 * the sim. Emission past MAX_PARTICLES is dropped so phones stay smooth.
 */
export interface Particles {
  /** Spawn `n` particles of a kind at art-px (x, y). Returns how many were created. */
  burst(def: EmitterDef, x: number, y: number, n: number, spread?: number): number;
  /** Rate emitter: call every frame with the same key; spawns `rate * dt` particles on average (carries the remainder). */
  emit(key: string, def: EmitterDef, x: number, y: number, rate: number, dt: number, spread?: number): void;
  update(dt: number): void;
  count(): number;
  dispose(): void;
}

export function createParticles(atlas: Atlas, L: Layers): Particles {
  const make = (parent: ParticleContainer['parent']) => {
    const c = new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, uvs: true, color: true, rotation: false },
      roundPixels: true,
    });
    parent?.addChild(c);
    return c;
  };
  const normal = make(L.fx);
  const additive = make(L.fxAdd);
  const live: Live[] = [];
  const free: Particle[] = [];
  const carry = new Map<string, number>();
  const texCache = new Map<EmitterDef, Texture[]>();

  const texOf = (def: EmitterDef): Texture[] => {
    let t = texCache.get(def);
    if (!t) {
      t = def.frames.flatMap((id) => {
        const s = atlas.stat(id);
        return s ? [s.tex] : [];
      });
      texCache.set(def, t);
    }
    return t;
  };

  function burst(def: EmitterDef, x: number, y: number, n: number, spread = 0): number {
    const tex = texOf(def);
    if (!tex.length) return 0;
    let made = 0;
    for (let i = 0; i < n && live.length < MAX_PARTICLES; i++) {
      const t = (def.frameByAge ? tex[0] : tex[Math.floor(Math.random() * tex.length)]) as Texture;
      const p = free.pop() ?? new Particle({ texture: t });
      p.texture = t;
      p.rotation = 0;
      p.scaleX = p.scaleY = def.scale ?? 1;
      p.anchorX = 0.5;
      p.anchorY = 0.5;
      if (def.tint !== undefined) p.tint = def.tint;
      else p.tint = 0xffffff;
      const l: Live = {
        p, def, tex,
        x: x + (Math.random() - 0.5) * spread * S,
        y: y + (Math.random() - 0.5) * spread * S * 0.5,
        vx: rnd(def.vx) * S, vy: rnd(def.vy) * S, age: 0, life: rnd(def.life), add: !!def.additive,
      };
      p.alpha = 0;
      p.x = Math.round(l.x);
      p.y = Math.round(l.y);
      (l.add ? additive : normal).addParticle(p);
      live.push(l);
      made++;
    }
    return made;
  }

  return {
    burst,
    emit(key, def, x, y, rate, dt, spread = 0) {
      const acc = (carry.get(key) ?? 0) + rate * dt;
      const n = Math.floor(acc);
      carry.set(key, acc - n);
      if (n > 0) burst(def, x, y, n, spread);
      if (carry.size > 600) carry.clear();
    },
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const l = live[i] as Live;
        l.age += dt;
        if (l.age >= l.life) {
          (l.add ? additive : normal).removeParticle(l.p);
          free.push(l.p);
          live[i] = live[live.length - 1] as Live;
          live.pop();
          continue;
        }
        const k = l.age / l.life;
        l.vx += (l.def.gx ?? 0) * S * dt;
        l.vy += (l.def.gy ?? 0) * S * dt;
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.p.x = Math.round(l.x);
        l.p.y = Math.round(l.y);
        if (l.def.frameByAge) l.p.texture = l.tex[Math.min(l.tex.length - 1, Math.floor(k * l.tex.length))] as Texture;
        const peak = l.def.alpha ?? 1;
        l.p.alpha = l.def.fade === 'none' ? peak : l.def.fade === 'out' ? peak * (1 - k) : peak * Math.min(k / 0.2, (1 - k) / 0.5, 1);
      }
    },
    count: () => live.length,
    dispose() {
      normal.destroy();
      additive.destroy();
      live.length = free.length = 0;
      carry.clear();
    },
  };
}
