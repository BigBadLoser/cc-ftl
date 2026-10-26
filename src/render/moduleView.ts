import { haloTex, makeHalo } from './haloTex';
import { Rectangle, Sprite, Texture, type Geometry, type Mesh, type Shader } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles, hullRow, openTilesOf, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import type { Art } from './assets/fallback';
import { pickParts } from './partPick';
import { iso, depthKey, TILE_W } from './iso';
import type { Layers } from './layers';
import { dim, lightTint, mulColor, pulsePhase } from './lightTint';
import { resolveArt } from './assets/fallback';
import { boxState, containerBox } from './containerBox';
import { ContainerC } from '../sim/containers/components';
import { createContainerOverlay } from './containerPaint';
import { SCHEMES } from './roofArt';
import type { ShipRuin } from '../sim/combat/components';
import { airlockLayers, createCollarAnimator, dockedAt } from './airlockArt';
import { robotBayLayers } from './robotBayArt';
import type { WallLevel } from './tiles';
import { createBayAnimator, shuttleHome, vehicleBayLayers } from './vehicleBayArt';
import { craftProgress, diagonalFront, moduleAssets, glowKey, layerKey, mannedConsoles, moduleLayers, showsActive, type ModuleLayer } from './moduleArt';

export type ModuleDefs = Readonly<Record<string, ModuleDef>>;

export interface ModuleViewHost {
  target(): { grid: Grid } | null;
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
  /** Roofed ships hide their interior: only the engines (hull sections, and the machines under the roof) are drawn. */
  roofed(): boolean;
  /** The wall view level of the art; only the airlock's hull block follows it (the airlock itself never cuts away). */
  level(): WallLevel;
  /** The derelict dressing of this ship, if it is one (module art overrides and wreck darkening). */
  ruin?(): ShipRuin | undefined;
  /** The ship's livery (its containers wear the scheme's colours and a company logo); none = bare plating. */
  livery?(): { scheme: string; seed: number } | null;
}

export interface ModuleView {
  update(): void;
  /** Module entity whose sprite covers an art-px point (topmost), or null. */
  pick(ax: number, ay: number): number | null;
  dispose(): void;
}

interface Part {
  spr: Sprite | Mesh<Geometry, Shader>;
  glow: Sprite | null;
  halo: Sprite | null;
  /** Art-px rectangle the sprite covers. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  key: number;
  /** Index of the layer it was built from (animated layers swap their texture). */
  li?: number;
  flip: boolean;
  /** Multiply tint of stand-in art (white for real art). */
  art: number;
  /** False while the current frame of an animated layer has no glow (flicker-off). */
  lit?: boolean;
}
interface Entry {
  sig: string;
  parts: Part[];
}

/** Depth key of a module sprite drawn on tile (tx, ty): solid modules sit just behind the crew of their tile, flat ones under everything. */
export function moduleKey(def: ModuleDef, tx: number, ty: number): number {
  return depthKey(tx, ty) - (def.solid ? 0.05 : 0.5);
}

/** Width of a depth strip of a vehicle bay sprite: one footprint diagonal, half a tile wide each side of its centre line. */
const STRIP_W = TILE_W / 2;
const stripCache = new WeakMap<Texture, Map<string, Texture>>();
/** Columns x0..x1 of a sheet frame as a texture of their own (cached: the animation re-cuts the same strips every loop). */
function cut(tex: Texture, x0: number, x1: number): Texture {
  let m = stripCache.get(tex);
  if (!m) stripCache.set(tex, (m = new Map()));
  const k = `${x0}:${x1}`;
  let t = m.get(k);
  if (!t) m.set(k, (t = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x + x0, tex.frame.y, x1 - x0, tex.frame.height) })));
  return t;
}

const grey = (f: number): number => {
  const c = Math.round(255 * f);
  return (c << 16) | (c << 8) | c;
};

/** Light tint of exterior pieces (containers) that room lighting never reaches. */
const EXTERIOR_TINT = 0xd8dce6;

/** A craft job counts as running while its progress moved within this many ms. */
const ACTIVE_MS = 400;

/** True if any enabled power source of the grid is running. */
export function shipHasPower(world: World, defs: ModuleDefs, grid: { inBounds(x: number, y: number): boolean }): boolean {
  for (const id of world.query(ModuleC)) {
    const m = world.get(id, ModuleC);
    if (m && grid.inBounds(m.x, m.y) && m.powered && m.enabled && m.hp > 0 && (defs[m.def]?.power ?? 0) > 0) return true;
  }
  return false;
}

/** Module sprites: anchored at the footprint's front tile, depth sorted, tinted by light and power, with state variants. */
export function createModuleView(world: World, atlas: Atlas, L: Layers, defs: ModuleDefs, host: ModuleViewHost): ModuleView {
  const mods = new Map<number, Entry>();
  const lastProgress = new Map<number, { value: number; at: number }>();
  const bayAnim = createBayAnimator();
  const collarAnim = createCollarAnimator();

  function dropEntry(e: Entry): void {
    for (const p of e.parts) {
      p.spr.destroy();
      p.glow?.destroy();
      p.halo?.destroy();
    }
  }

  function makePart(s: StaticSprite, tx: number, ty: number, flip: boolean, key: number, art = 0xffffff, glowKey = key + 0.01, overlay?: 'paint' | 'lv'): Part {
    const p = iso(tx, ty);
    const w = s.tex.width;
    const h = s.tex.height;
    const x = Math.round(p.x + (flip ? s.ax : -s.ax));
    const y = Math.round(p.y - s.ay);
    const mk = (tex: typeof s.tex) => {
      const spr = new Sprite(tex);
      spr.position.set(x, y);
      if (flip) spr.scale.x = -1;
      return spr;
    };
    const sch = overlay && SCHEMES[host.livery?.()?.scheme ?? ''];
    const spr = sch && overlay ? createContainerOverlay(overlay, s, sch.P, sch.S) : mk(s.tex);
    if (sch && overlay) spr.position.set(x, y);
    spr.zIndex = key;
    L.sorted.addChild(spr);
    let glow: Sprite | null = null;
    let halo: Sprite | null = null;
    if (s.glow) {
      glow = mk(s.glow);
      glow.blendMode = 'add';
      glow.zIndex = glowKey;
      L.sorted.addChild(glow);
      if (L.halos) {
        halo = makeHalo(s.glow, x, y, flip);
        halo.zIndex = glowKey + 0.005;
        L.sorted.addChild(halo);
      }
    }
    const x0 = flip ? x - w : x;
    return { spr, glow, halo, rect: { x0, y0: y, x1: x0 + w, y1: y + h }, key, flip, art };
  }

  function build(m: Module, def: ModuleDefs[string], layers: { layer: ModuleLayer; art: Art }[], roofed: boolean): Part[] {
    const [w, h] = rotatedSize(def, m.rot);
    const [nw, nh] = def.footprint;
    const out: Part[] = [];
    layers.forEach(({ layer, art }, i) => {
      const s = art.s;
      const from = out.length;
      const key = (tx: number, ty: number) => layerKey(def, m, layer, i, roofed, moduleKey(def, tx, ty));
      if (layer.at) {
        const k = key(layer.at.x, layer.at.y);
        out.push(makePart(s, layer.at.x, layer.at.y, false, k, art.tint, glowKey(layer, k)));
        return;
      }
      if (art.fallback && art.perTile) {
        // A stand-in covers the footprint tile by tile (never the walkable open tiles, nor the hull row for the machine).
        const skip = new Set((layer.tiles === 'hull' ? [] : openTilesOf(def, m.x, m.y, m.rot)).map((t) => `${t.x},${t.y}`));
        const hull = new Set(hullRow(def, m.x, m.y, m.rot).map((t) => `${t.x},${t.y}`));
        for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
          const k = `${t.x},${t.y}`;
          if (skip.has(k) || (layer.tiles !== 'all' && (layer.tiles === 'hull') !== hull.has(k))) continue;
          out.push(makePart(s, t.x, t.y, false, key(t.x, t.y), art.tint));
        }
        return;
      }
      if (layer.strips && !art.fallback) {
        // Cut into one strip per footprint diagonal, each sorted by the front-most footprint tile on its diagonal (the pit's
        // near lip, towers and gangway then draw over crew beside the pit, and under crew in front of it).
        const tx = m.x + w - 1;
        const ty = m.y + h - 1;
        const dMin = m.x - ty;
        const dMax = tx - m.y;
        const kLo = Math.floor((-s.ax + STRIP_W / 2) / STRIP_W);
        const kHi = Math.ceil((s.tex.width - s.ax - STRIP_W / 2) / STRIP_W);
        for (let k = kLo; k <= kHi; k++) {
          const x0 = Math.max(0, Math.round(k * STRIP_W - STRIP_W / 2 + s.ax));
          const x1 = Math.min(s.tex.width, Math.round(k * STRIP_W + STRIP_W / 2 + s.ax));
          if (x1 <= x0) continue;
          const d = Math.min(dMax, Math.max(dMin, tx - ty + k));
          const f = diagonalFront(m.x, m.y, w, h, d);
          const sk = key(f.x, f.y);
          const sub = { tex: cut(s.tex, x0, x1), glow: s.glow ? cut(s.glow, x0, x1) : null, ax: s.ax - x0, ay: s.ay, footprint: s.footprint };
          out.push(makePart(sub, tx, ty, false, sk, art.tint, glowKey(layer, sk), layer.overlay));
        }
        return;
      }
      // A quarter turn of a non-square footprint without its own sprite is drawn mirrored.
      const flip = nw !== nh && m.rot % 2 === 1 && s.footprint[0] === nw && s.footprint[1] === nh;
      const k = key(m.x + w - 1, m.y + h - 1);
      out.push(makePart(s, m.x + w - 1, m.y + h - 1, flip, k, art.tint, glowKey(layer, k), layer.overlay));
      for (let j = from; j < out.length; j++) out[j]!.li = i;
    });
    return out;
  }

  /** Module art ids by asset prefix (the manifest is fixed, so this is read once per def), for "does the art have .unpowered / .active.f1". */
  const artIds = new Map<string, Set<string>>();
  const hasArt = (asset: string) => (id: string): boolean => {
    let ids = artIds.get(asset);
    if (!ids) artIds.set(asset, (ids = new Set(atlas.ids(asset))));
    return ids.has(id);
  };

  /** Show the next frame of an animated layer on its existing parts: swap the textures, build nothing. */
  function swapFrame(parts: Part[], li: number, s: StaticSprite): void {
    for (const p of parts) {
      if (p.li !== li) continue;
      p.lit = !!s.glow;
      if (p.spr.texture === s.tex) continue;
      p.spr.texture = s.tex;
      if (p.glow && s.glow) {
        p.glow.texture = s.glow;
        if (p.halo) p.halo.texture = haloTex(s.glow);
      }
    }
  }

  /** True while the module's craft job made progress in the last moment. */
  function crafting(progress: Map<number, number>, id: number, now: number): boolean {
    const p = progress.get(id);
    if (p === undefined) {
      lastProgress.delete(id);
      return false;
    }
    const prev = lastProgress.get(id);
    if (!prev || prev.value !== p) lastProgress.set(id, { value: p, at: p > 0 ? now : -Infinity });
    return now - (lastProgress.get(id)?.at ?? -Infinity) < ACTIVE_MS;
  }

  /** The ruin records of the current derelict by local module tile (rebuilt when the ship's ruin data changes). */
  let ruinData: ShipRuin | undefined;
  let ruinMods = new Map<string, ShipRuin['modules'][number]>();
  /**
   * What a derelict's ruin does to a module's look: extra art ids to try first (state-suffix art, a ruin override such as a
   * broken light or a dormant fabricator, flickering) and a darkening factor when it has no art of its own.
   */
  function ruinLook(id: number, m: Module, def: ModuleDefs[string], on: boolean, now: number): { chain: string[]; dark: number } {
    const none = { chain: [] as string[], dark: 1 };
    const ruin = host.ruin?.();
    if (!ruin) return none;
    if (ruin !== ruinData) {
      ruinData = ruin;
      ruinMods = new Map(ruin.modules.map((r) => [`${r.x},${r.y}`, r]));
    }
    const t = host.target();
    const r = t && ruinMods.get(`${m.x - t.grid.x0},${m.y - t.grid.y0}`);
    if (!r) return none;
    const state = r.state === 'destroyed' ? (m.hp <= 0 ? 'destroyed' : '') : r.state === 'damaged' ? (m.hp < def.maxHp ? 'damaged' : '') : '';
    const art = r.art && !r.art.startsWith('decay.') && (state === 'destroyed' || !on) && (r.state !== 'damaged' || state === 'damaged' || !on) ? r.art : undefined;
    const blip = r.flicker && Math.floor(now / 170 + m.x * 7 + m.y * 3) % 3 === 0;
    const chain = art && !blip ? [art] : [];
    if (state && !art) chain.push(...moduleAssets(world, id, m, def, false).map((id) => `${id}.${state}`));
    return { chain, dark: state === 'destroyed' ? 0.5 : state === 'damaged' ? 0.8 : 1 };
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    if (t) {
      const now = performance.now();
      const progress = craftProgress(world);
      const manned = mannedConsoles(world);
      const { grid } = t;
      const emergency = host.emergency();
      const pulse = emergency ? pulsePhase(now) : -1;
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || !grid.inBounds(m.x, m.y)) continue;
        const on = m.powered && m.enabled && m.hp > 0;
        // Modules are in sector tiles; their art is built region-local (the region's containers sit at its sector offset).
        const lm: Module = { ...m, x: m.x - grid.x0, y: m.y - grid.y0 };
        const active = showsActive(def, on, !!def.crafting && crafting(progress, id, now), manned.has(id));
        const roofed = host.roofed();
        const level = host.level();
        const raw = def.robotBay ? robotBayLayers(world, id, lm, def, now)
          : def.vehicleBay ? vehicleBayLayers(lm, def, bayAnim.stepOf(id, shuttleHome(world, id), now))
          : def.airlock?.layout ? airlockLayers(world, id, lm, def, { level, roofed, collar: collarAnim.stepOf(id, dockedAt(world, id) !== 0, now) })
          : moduleLayers(world, id, lm, def, active, true, host.livery?.(), { off: !on && m.hp > 0, now, hp: m.hp, maxHp: def.maxHp, has: hasArt(def.asset) });
        const wreck = ruinLook(id, m, def, on, now);
        const withRuin = wreck.chain.length ? raw.map((l, i) => (i === 0 ? { ...l, chain: [...wreck.chain, ...l.chain] } : l)) : raw;
        const layers = withRuin.flatMap((layer) => {
          // Containers ride outside the hull: never under a roof.
          if (roofed && !def.container && !(layer.at ? layer.roofVisible : layer.tiles === 'hull' || (def.hullEdge && layer.tiles === 'rest'))) return [];
          // firstOf queues the sheet; while it loads the container draws nothing (not the stand-in box).
          const first = def.container ? atlas.firstOf(layer.chain) : undefined;
          if (def.container && !first && atlas.loading(layer.chain)) return [];
          if (layer.optional) {
            const o = first;
            return o ? [{ layer, art: { s: o, tint: 0xffffff, scale: 1, fallback: false, lift: 0, perTile: false, rise: 1 } as Art }] : [];
          }
          if (def.container && !first) {
            // PLACEHOLDER until the container sheets land: a drawn box (with its own clamp mark) for the shell, no clamp layer.
            if (layer.at) return [];
            const [bw, bh] = rotatedSize(def, m.rot);
            const box = containerBox(bw, bh, boxState(m.hp, def.maxHp), world.get(id, ContainerC)?.clamp ?? 'n');
            return [{ layer, art: { s: box, tint: 0xffffff, scale: 1, fallback: false, lift: 0, perTile: false, rise: 1 } as Art }];
          }
          const art = resolveArt(atlas, layer.chain, layer.key);
          return art ? [{ layer, art }] : [];
        });
        if (!layers.length) continue;
        live.add(id);
        const sig = `${m.def}|${m.x}|${m.y}|${m.rot}|${roofed ? 1 : 0}|${level}|${layers.map((l) => (l.layer.anim ? `~${l.layer.anim}` : l.art.s.tex.uid)).join(',')}`;
        let e = mods.get(id);
        if (e && e.sig !== sig) {
          dropEntry(e);
          e = undefined;
        }
        // An animated layer is built from its base frame (which has the glow), then its frames swap texture on the same parts.
        if (!e) mods.set(id, (e = { sig, parts: build(lm, def, wreck.chain.length ? layers : layers.map((l) => {
          const base = l.layer.anim && atlas.stat(l.layer.anim);
          return base && base.glow ? { ...l, art: { ...l.art, s: base } } : l;
        }), roofed) }));
        layers.forEach((l, i) => { if (l.layer.anim) swapFrame(e.parts, i, l.art.s); });
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let lsum = 0;
        for (const f of tiles) lsum += grid.inBounds(f.x, f.y) ? grid.get('light', f.x, f.y) : 0;
        // A container is outside, lit by the sky like the hull (no room light reaches it), and never "off".
        const base = def.container ? EXTERIOR_TINT : lightTint(lsum / Math.max(1, tiles.length), false, pulse);
        const lit = on || def.container ? base : dim(mulColor(base, 0xc8c8d4), 0.78);
        // A wreck without its own damaged / destroyed art is darkened instead.
        const tint = wreck.dark < 1 && !wreck.chain.some((id) => atlas.stat(id)) ? mulColor(lit, grey(wreck.dark)) : lit;
        for (const p of e.parts) {
          p.spr.tint = mulColor(tint, p.art);
          for (const g of [p.glow, p.halo]) if (g) g.visible = on && p.lit !== false;
          if (def.robotBay && p.glow) p.glow.alpha = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin((now / 1600) * Math.PI * 2)); // charging pulse
        }
      }
    }
    for (const [id, e] of mods) {
      if (live.has(id)) continue;
      dropEntry(e);
      mods.delete(id);
      bayAnim.forget(id);
      collarAnim.forget(id);
    }
  }

  return {
    update,
    pick: (ax, ay) => pickParts(mods, ax, ay),
    dispose() {
      for (const e of mods.values()) dropEntry(e);
      mods.clear();
      lastProgress.clear();
    },
  };
}
