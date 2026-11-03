import { Container, Sprite } from 'pixi.js';
import type { World } from '../sim/ecs';
import { CombatC, ShipC, type Ship } from '../sim/combat/components';
import type { GridLike } from '../sim/grid';
import { Struct } from '../sim/structure';
import type { Atlas } from './assets/loader';
import { ROOF_H } from './heights';
import { ART_SCALE as S, TILE_H, TILE_W } from './iso';
import { sectorArt } from './sectorPos';

/** How a shot met the bubble: absorbed (laser, a mass driver stopped by a thicker shield), ion drain, a mass driver tearing through. */
export type ShieldHitKind = 'absorb' | 'ion' | 'pierce';

export interface ShieldView {
  /** A shot met ship `ship`'s bubble; `from` (sector art px) is where it came from, so the flare sits on that side. */
  hit(ship: number, kind: ShieldHitKind, from: { x: number; y: number } | undefined): void;
  update(dt: number, now: number): void;
  dispose(): void;
}

/** Shells drawn at most; layers above it brighten the outer shell instead of adding rings. */
export const MAX_SHELLS = 4;
/** World px between shells. */
const GAP = 10 * S;
/** Margin between the hull's fitted ellipse and the inner shell. */
const MARGIN = 8 * S;
const EDGE = ['fx.shield_edge.l1', 'fx.shield_edge.l2', 'fx.shield_edge.l3'] as const;
/** Rest alpha per variant (additive): quiet enough not to hide the ship. */
const ALPHA = [0.4, 0.55, 0.75] as const;
const EDGE_FPS = 4;
const HIT_FPS = 12;
const HIT_ART: Readonly<Record<ShieldHitKind, string>> = { absorb: 'fx.shield_hit', ion: 'fx.shield_hit.ion', pierce: 'fx.shield_pierce' };
const HIT_FRAMES = 6;
const OVERCHARGE_MS = 700;
const SAMPLES = 128;

interface Ring {
  root: Container;
  sprites: Sprite[];
  variant: number;
}
/** An ellipse in sector art px: centre, semi-axes, and the rotation of its rx axis. */
export interface Fit {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
}
interface Bubble extends Fit {
  key: string;
  rings: Ring[];
  root: Container;
  seen: boolean;
}
interface Hit {
  spr: Sprite;
  art: string;
  age: number;
}

/**
 * The variant (index into EDGE) of shell `i` when `shown` shells are up: the outermost is the bright l3 (it breaks next),
 * the one under it l2, the rest the faint l1.
 */
export function shellVariant(i: number, shown: number): number {
  return i === shown - 1 ? 2 : i === shown - 2 ? 1 : 0;
}

/** The ellipse round a ship's bounding box (no grid to fit to): its floor diamond, lifted to half roof height and padded. */
export function boxFit(s: Pick<Ship, 'x' | 'y' | 'width' | 'height'>): Fit {
  const c = sectorArt(s.x + s.width / 2, s.y + s.height / 2);
  // A w x h box's corners sit on the 2:1 ellipse of "radius" k = sqrt((w^2 + h^2) / 2) tiles.
  const k = Math.sqrt((s.width * s.width + s.height * s.height) / 2);
  return { cx: c.x, cy: c.y - ROOF_H / 2, rx: (k * TILE_W) / 2 + MARGIN, ry: (k * TILE_H) / 2 + ROOF_H / 2 + MARGIN / 2, rot: 0 };
}

/** Smallest semi-minor axis, as a share of the major one: a long thin hull still gets an oval, not a sliver. */
const MIN_ASPECT = 0.38;

/**
 * The ellipse round a set of points (art px), turned to their long axis: the principal axis of the points, the box
 * they fill along it, grown evenly until every point is inside, then padded.
 */
export function fitPoints(xs: readonly number[], ys: readonly number[]): Fit | undefined {
  const n = xs.length;
  if (!n) return undefined;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] as number;
    my += ys[i] as number;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const rot = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    const lx = dx * c + dy * sn;
    const ly = -dx * sn + dy * c;
    x0 = Math.min(x0, lx);
    x1 = Math.max(x1, lx);
    y0 = Math.min(y0, ly);
    y1 = Math.max(y1, ly);
  }
  const ox = (x0 + x1) / 2;
  const oy = (y0 + y1) / 2;
  const a = Math.max(1, (x1 - x0) / 2);
  const b = Math.max(a * MIN_ASPECT, (y1 - y0) / 2, 1);
  let k = 1;
  for (let i = 0; i < n; i++) {
    const dx = (xs[i] as number) - mx;
    const dy = (ys[i] as number) - my;
    const lx = dx * c + dy * sn - ox;
    const ly = -dx * sn + dy * c - oy;
    k = Math.max(k, Math.hypot(lx / a, ly / b));
  }
  return { cx: mx + ox * c - oy * sn, cy: my + ox * sn + oy * c, rx: a * k + MARGIN, ry: b * k + MARGIN, rot };
}

/** The bubble round a ship's hull: every non-space tile's corners at floor and roof height. */
export function hullFit(g: GridLike): Fit | undefined {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = g.y0; y < g.y0 + g.height; y++) {
    for (let x = g.x0; x < g.x0 + g.width; x++) {
      if (g.get('struct', x, y) === Struct.Space) continue;
      for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]] as const) {
        const p = sectorArt(cx + 0.5, cy + 0.5);
        xs.push(p.x, p.x);
        ys.push(p.y, p.y - ROOF_H);
      }
    }
  }
  return fitPoints(xs, ys);
}

/** Points at equal arc length round an ellipse: position and tangent angle per piece. */
export function ellipsePieces(rx: number, ry: number, len: number): { x: number; y: number; rot: number; step: number }[] {
  const cum = [0];
  let px = rx;
  let py = 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = (i / SAMPLES) * Math.PI * 2;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    cum.push((cum[i - 1] as number) + Math.hypot(x - px, y - py));
    px = x;
    py = y;
  }
  const per = cum[SAMPLES] as number;
  const n = Math.max(8, Math.round(per / len));
  const out: { x: number; y: number; rot: number; step: number }[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const want = ((k + 0.5) / n) * per;
    while (j < SAMPLES - 1 && (cum[j + 1] as number) < want) j++;
    const f = (want - (cum[j] as number)) / ((cum[j + 1] as number) - (cum[j] as number) || 1);
    const t = ((j + f) / SAMPLES) * Math.PI * 2;
    // Screen y points down, so increasing t runs clockwise; the piece's inside (-v in the art) then faces the centre.
    out.push({ x: rx * Math.cos(t), y: ry * Math.sin(t), rot: Math.atan2(ry * Math.cos(t), -rx * Math.sin(t)), step: per / n });
  }
  return out;
}

/**
 * Persistent shield bubbles: one per ship with shield layers up, a ring of `fx.shield_edge.l*` pieces per layer laid
 * round an ellipse fitted to the hull, plus the hit flares. Lives in the sector air layer, so the main view and the
 * combat panel's camera both draw it. Reads the sim only.
 */
export function createShieldView(world: World, atlas: Atlas, parent: Container, hull: (ship: number) => GridLike | undefined): ShieldView {
  const root = new Container();
  parent.addChild(root);
  const bubbles = new Map<number, Bubble>();
  const hits: Hit[] = [];
  const pool: Sprite[] = [];
  let frame = -1;

  /** Show frame `id` on a sprite (frames are cropped apart, so the anchor goes with the texture); false while it is not loaded. */
  function place(spr: Sprite, id: string): boolean {
    const st = atlas.stat(id);
    if (!st) return false;
    if (spr.texture !== st.tex) {
      spr.texture = st.tex;
      spr.anchor.set(st.ax / st.tex.width, st.ay / st.tex.height);
    }
    return true;
  }

  function buildRing(b: Bubble, i: number): Ring | undefined {
    const st = atlas.stat(`${EDGE[2]}.0`);
    if (!st) return undefined;
    const ring: Ring = { root: new Container(), sprites: [], variant: -1 };
    for (const p of ellipsePieces(b.rx + i * GAP, b.ry + i * GAP, st.tex.width)) {
      const spr = new Sprite(st.tex);
      spr.anchor.set(st.ax / st.tex.width, st.ay / st.tex.height);
      spr.position.set(Math.round(p.x), Math.round(p.y));
      spr.rotation = p.rot;
      spr.scale.x = p.step / st.tex.width;
      ring.root.addChild(spr);
      ring.sprites.push(spr);
    }
    b.root.addChild(ring.root);
    return ring;
  }

  function drop(b: Bubble): void {
    b.root.destroy({ children: true });
  }

  function sync(id: number, s: Ship, layers: number, now: number, overcharged: boolean): void {
    const g = hull(id);
    const key = `${s.x},${s.y},${s.width},${s.height},${g ? g.revision('struct') : -1}`;
    let b = bubbles.get(id);
    if (b && b.key !== key) {
      drop(b);
      bubbles.delete(id);
      b = undefined;
    }
    if (!b) {
      const fit = (g && hullFit(g)) ?? boxFit(s);
      b = { key, ...fit, rings: [], root: new Container(), seen: true };
      b.root.position.set(Math.round(fit.cx), Math.round(fit.cy));
      b.root.rotation = fit.rot;
      root.addChild(b.root);
      bubbles.set(id, b);
    }
    b.seen = true;
    const shown = Math.min(layers, MAX_SHELLS);
    const extra = Math.max(0, layers - MAX_SHELLS);
    const pulse = overcharged ? 0.8 + 0.4 * Math.sin((now / OVERCHARGE_MS) * Math.PI * 2) : 1;
    for (let i = 0; i < MAX_SHELLS; i++) {
      let ring = b.rings[i];
      if (i >= shown) {
        if (ring) ring.root.visible = false;
        continue;
      }
      if (!ring) {
        ring = buildRing(b, i);
        if (!ring) return;
        b.rings[i] = ring;
      }
      ring.root.visible = true;
      const v = shellVariant(i, shown);
      if (v !== ring.variant) {
        ring.variant = v;
        for (const spr of ring.sprites) place(spr, `${EDGE[v]}.${Math.max(0, frame)}`);
      }
      const boost = v === 2 ? 0.1 * extra : 0;
      ring.root.alpha = Math.min(1, (ALPHA[v] as number) * pulse + boost);
    }
  }

  return {
    hit(ship, kind, from) {
      const b = bubbles.get(ship);
      const s = world.get(ship, ShipC);
      if (!s) return;
      const fit: Fit = b ?? boxFit(s);
      const c = world.get(ship, CombatC);
      // the shell the shot met: the outermost one up (for a drain or a tear the one it is taking), else the inner shell
      const shell = Math.max(0, Math.min(MAX_SHELLS, (c?.shield.layers ?? 0) + (kind === 'pierce' ? 0 : 1)) - 1);
      const a = fit.rx + shell * GAP;
      const r = fit.ry + shell * GAP;
      const c0 = Math.cos(fit.rot);
      const s0 = Math.sin(fit.rot);
      // in the ellipse's own frame: the point of the rim facing the shot's origin
      const dx = from ? from.x - fit.cx : 0;
      const dy = from ? from.y - fit.cy : -1;
      const t = Math.atan2((-dx * s0 + dy * c0) / r, (dx * c0 + dy * s0) / a);
      const lx = a * Math.cos(t);
      const ly = r * Math.sin(t);
      const spr = pool.pop() ?? new Sprite();
      const art = HIT_ART[kind];
      if (!place(spr, `${art}.0`)) {
        pool.push(spr);
        return;
      }
      spr.position.set(Math.round(fit.cx + lx * c0 - ly * s0), Math.round(fit.cy + lx * s0 + ly * c0));
      spr.alpha = 1;
      spr.visible = true;
      root.addChild(spr);
      hits.push({ spr, art, age: 0 });
    },
    update(dt, now) {
      const f = Math.floor((now / 1000) * EDGE_FPS) % 4;
      if (f !== frame) {
        frame = f;
        for (const b of bubbles.values()) {
          for (const ring of b.rings) {
            if (!ring || ring.variant < 0) continue;
            for (const spr of ring.sprites) place(spr, `${EDGE[ring.variant]}.${f}`);
          }
        }
      }
      for (const b of bubbles.values()) b.seen = false;
      for (const id of world.query(ShipC, CombatC)) {
        const s = world.get(id, ShipC);
        const c = world.get(id, CombatC);
        if (!s || !c || c.shield.layers <= 0 || s.state === 'fled' || s.state === 'wreck' || s.outpost?.hidden) continue;
        sync(id, s, c.shield.layers, now, c.heat.overcharge.shields.left > 0);
      }
      for (const [id, b] of bubbles) {
        if (b.seen) continue;
        drop(b);
        bubbles.delete(id);
      }
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i] as Hit;
        h.age += dt;
        const k = Math.floor(h.age * HIT_FPS);
        if (k >= HIT_FRAMES) {
          h.spr.removeFromParent();
          pool.push(h.spr);
          hits.splice(i, 1);
          continue;
        }
        place(h.spr, `${h.art}.${k}`);
      }
    },
    dispose() {
      for (const b of bubbles.values()) drop(b);
      bubbles.clear();
      for (const h of hits) h.spr.destroy();
      for (const s of pool) s.destroy();
      hits.length = pool.length = 0;
      root.destroy({ children: true });
    },
  };
}
