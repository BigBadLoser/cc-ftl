import { Container, Sprite } from 'pixi.js';
import type { Geometry, Mesh, Shader } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CombatC, ShipC } from '../sim/combat/components';
import type { GridLike } from '../sim/grid';
import type { Atlas } from './assets/loader';
import { ART_SCALE } from './iso';
import { createDomeMesh, DOME_HITS, type DomeUniforms } from './shieldDome';
import { boxFit, fitExtent, hullFit, rimPoint, type Fit } from './shieldFit';
import { DOME_FPS, DOME_SEC, domeAge, domeVisible, newDome, stepDome, type DomeState } from './shieldState';

/** How a shot met the bubble: absorbed (laser; a mass driver stopped by a thicker shield), ion drain, a mass driver tearing through. */
export type ShieldHitKind = 'absorb' | 'ion' | 'pierce';

export interface ShieldView {
  /** A shot met ship `ship`'s bubble; `from` (sector art px) is where it came from, so the hit lands on that side. */
  hit(ship: number, kind: ShieldHitKind, from: { x: number; y: number } | undefined): void;
  update(dt: number, now: number): void;
  dispose(): void;
}

const KIND_CODE: Readonly<Record<ShieldHitKind, number>> = { absorb: 1, ion: 2, pierce: 3 };
/** The fx_shield sprite piece each kind of hit shows. */
export const SHIELD_SPRITE: Readonly<Record<ShieldHitKind, { art: string; frames: number }>> = {
  absorb: { art: 'fx.shield_flash', frames: 10 },
  ion: { art: 'fx.shield_flash.ion', frames: 10 },
  pierce: { art: 'fx.shield_pierce', frames: 12 },
};
/** Sprite pieces play at this rate. */
export const SPRITE_FPS = 14;
/** One overcharge pulse, ms. */
const OVERCHARGE_MS = 900;

/** A hit on the bubble: where on the rim (bubble frame), when (animation ms) and what kind. */
export interface DomeHit {
  lx: number;
  ly: number;
  at: number;
  kind: ShieldHitKind;
}
interface Dome {
  key: string;
  fit: Fit;
  mesh: Mesh<Geometry, Shader>;
  u: DomeUniforms;
  state: DomeState;
  hits: DomeHit[];
  seen: boolean;
}
interface Piece {
  spr: Sprite;
  art: string;
  frames: number;
  age: number;
}

const hitSec = (h: DomeHit): number => (h.kind === 'pierce' ? DOME_SEC.pierce : DOME_SEC.hit);

/**
 * Set a dome's uniforms for the moment `now` (animation ms) from its state, its hits (the latest DOME_HITS are drawn) and
 * whether the shields are overcharged. Returns whether the dome has anything to draw. The render lab draws through this too.
 */
export function paintDome(u: DomeUniforms, st: DomeState, hits: readonly DomeHit[], overcharged: boolean, now: number): boolean {
  u.uLit = Math.min(st.layers, 8);
  const pulse = Math.floor((now / OVERCHARGE_MS) * DOME_FPS * (OVERCHARGE_MS / 1000)) / (DOME_FPS * (OVERCHARGE_MS / 1000));
  u.uOver = overcharged && st.layers > 0 ? 0.5 - 0.5 * Math.cos(pulse * Math.PI * 2) : 0;
  const ev = u.uEv;
  ev[0] = domeAge(st.breakAt, DOME_SEC.break, now);
  ev[1] = domeAge(st.regenAt, DOME_SEC.regen, now);
  ev[2] = domeAge(st.downAt, DOME_SEC.down, now);
  ev[3] = st.downRows;
  u.uEv = ev;
  const h = u.uHit;
  let live = 0;
  for (let i = 0; i < DOME_HITS; i++) {
    const x = hits[hits.length - 1 - i];
    const age = x ? domeAge(x.at, hitSec(x), now) : -1;
    if (age >= 0) live++;
    h[i * 4] = x?.lx ?? 0;
    h[i * 4 + 1] = x?.ly ?? 0;
    h[i * 4 + 2] = age;
    h[i * 4 + 3] = x ? KIND_CODE[x.kind] : 0;
  }
  u.uHit = h;
  return domeVisible(st, now) || live > 0;
}

/**
 * Shield domes: one per ship with shields (or a break or collapse still playing), fitted to its hull, drawn by the dome
 * shader (shieldDome.ts), plus the fx_shield sprite pieces at the hit point. Lives in the sector air layer, so the main
 * view and the combat panel's camera both draw it. Reads the sim only.
 */
export function createShieldView(
  world: World, atlas: Atlas, layers: { dome: Container; add: Container }, hull: (ship: number) => GridLike | undefined,
): ShieldView {
  const domes = new Map<number, Dome>();
  const pieces: Piece[] = [];
  const pool: Sprite[] = [];

  function make(id: number, key: string, fit: Fit, state: DomeState): Dome {
    const { ex, ey } = fitExtent(fit);
    const pad = 1.12;
    const { mesh, uniforms: u } = createDomeMesh(fit.cx - ex * pad, fit.cy - ey * pad, fit.cx + ex * pad, fit.cy + ey * pad);
    u.uC = new Float32Array([fit.cx, fit.cy]);
    u.uAx = new Float32Array([fit.rx, fit.ry]);
    u.uRot = fit.rot;
    u.uPx = ART_SCALE;
    layers.dome.addChild(mesh);
    const d: Dome = { key, fit, mesh, u, state, hits: [], seen: true };
    domes.set(id, d);
    return d;
  }

  function drop(id: number, d: Dome): void {
    d.mesh.destroy();
    domes.delete(id);
  }

  function place(spr: Sprite, id: string): boolean {
    const st = atlas.stat(id);
    if (!st) return false;
    if (spr.texture !== st.tex) {
      spr.texture = st.tex;
      spr.anchor.set(st.ax / st.tex.width, st.ay / st.tex.height);
    }
    return true;
  }

  function sync(id: number, now: number): void {
    const s = world.get(id, ShipC);
    const c = world.get(id, CombatC);
    if (!s || !c) return;
    const gone = s.state === 'fled' || s.state === 'wreck' || !!s.outpost?.hidden;
    const layers = gone ? 0 : c.shield.layers;
    let d = domes.get(id);
    if (!d && layers <= 0) return;
    const g = hull(id);
    const key = `${s.x},${s.y},${s.width},${s.height},${g ? g.revision('struct') : -1}`;
    if (d && d.key !== key) {
      const state = d.state;
      drop(id, d);
      d = make(id, key, (g && hullFit(g)) ?? boxFit(s), state);
    }
    d ??= make(id, key, (g && hullFit(g)) ?? boxFit(s), newDome(0));
    d.seen = true;
    stepDome(d.state, layers, c.heat.vent > 0 || c.heat.lockout > 0, now);
    if (gone && !domeVisible(d.state, now)) {
      drop(id, d);
      return;
    }
    d.hits = d.hits.filter((x) => domeAge(x.at, hitSec(x), now) >= 0);
    d.mesh.visible = paintDome(d.u, d.state, d.hits, c.heat.overcharge.shields.left > 0, now);
  }

  let clock = 0;
  return {
    hit(ship, kind, from) {
      const s = world.get(ship, ShipC);
      if (!s) return;
      const d = domes.get(ship);
      const fit = d?.fit ?? boxFit(s);
      const p = rimPoint(fit, from);
      d?.hits.push({ lx: p.lx, ly: p.ly, at: clock, kind });
      const spr = pool.pop() ?? new Sprite();
      const art = SHIELD_SPRITE[kind];
      if (!place(spr, `${art.art}.0`)) {
        pool.push(spr);
        return;
      }
      spr.position.set(Math.round(p.x), Math.round(p.y));
      // the tear's shards and streak fly on along the shot, toward the hull
      spr.rotation = kind === 'pierce' && from ? Math.atan2(p.y - from.y, p.x - from.x) : 0;
      spr.alpha = 1;
      layers.add.addChild(spr);
      pieces.push({ spr, art: art.art, frames: art.frames, age: 0 });
    },
    update(dt, now) {
      clock = now;
      for (const d of domes.values()) d.seen = false;
      for (const id of world.query(ShipC, CombatC)) sync(id, now);
      for (const [id, d] of domes) if (!d.seen) drop(id, d);
      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i] as Piece;
        p.age += dt;
        const k = Math.floor(p.age * SPRITE_FPS);
        if (k >= p.frames) {
          p.spr.removeFromParent();
          pool.push(p.spr);
          pieces.splice(i, 1);
          continue;
        }
        place(p.spr, `${p.art}.${k}`);
      }
    },
    dispose() {
      for (const [id, d] of domes) drop(id, d);
      for (const p of pieces) p.spr.destroy();
      for (const s of pool) s.destroy();
      pieces.length = pool.length = 0;
    },
  };
}
