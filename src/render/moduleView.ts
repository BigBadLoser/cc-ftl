import { Container, Sprite, type Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles, hullRow, openTilesOf, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import type { Art } from './assets/fallback';
import { iso, depthKey } from './iso';
import type { Layers } from './layers';
import { dim, lightTint, mulColor, pulsePhase } from './lightTint';
import { resolveArt } from './assets/fallback';
import { craftProgress, glowKey, layerKey, mannedConsoles, moduleLayers, showsActive, type ModuleLayer } from './moduleArt';

export type ModuleDefs = Readonly<Record<string, ModuleDef>>;

export interface ModuleViewHost {
  target(): { grid: Grid } | null;
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
  /** Roofed ships hide their interior: only the engines (hull sections, and the machines under the roof) are drawn. */
  roofed(): boolean;
}

export interface ModuleView {
  update(): void;
  /** Module entity whose sprite covers an art-px point (topmost), or null. */
  pick(ax: number, ay: number): number | null;
  dispose(): void;
}

/** Alpha channel of a sprite's frame, cut lazily from its sheet so picking ignores transparent corners. */
const alphaCache = new WeakMap<Texture, Uint8ClampedArray | null>();
function alphaOf(tex: Texture): Uint8ClampedArray | null {
  if (alphaCache.has(tex)) return alphaCache.get(tex) ?? null;
  let out: Uint8ClampedArray | null = null;
  try {
    const { x, y, width, height } = tex.frame;
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const g = c.getContext('2d', { willReadFrequently: true });
    const src = tex.source.resource as CanvasImageSource;
    if (g) {
      g.drawImage(src, x, y, width, height, 0, 0, width, height);
      const d = g.getImageData(0, 0, width, height).data;
      out = new Uint8ClampedArray(width * height);
      for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] as number;
    }
  } catch {
    out = null;
  }
  alphaCache.set(tex, out);
  return out;
}

interface Part {
  spr: Sprite;
  glow: Sprite | null;
  /** Halo group sorted under the crew (a console's desk front), destroyed with the part. */
  under: Container | null;
  halo: Sprite | null;
  /** Art-px rectangle the sprite covers. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  key: number;
  flip: boolean;
  /** Multiply tint of stand-in art (white for real art). */
  art: number;
}
interface Entry {
  sig: string;
  parts: Part[];
}

/** Depth key of a module sprite drawn on tile (tx, ty): solid modules sit just behind the crew of their tile, flat ones under everything. */
export function moduleKey(def: ModuleDef, tx: number, ty: number): number {
  return depthKey(tx, ty) - (def.solid ? 0.05 : 0.5);
}

/** A craft job counts as running while its progress moved within this many ms. */
const ACTIVE_MS = 400;

/** True if any enabled power source of the grid is running. */
export function shipHasPower(world: World, defs: ModuleDefs, gridId: number): boolean {
  for (const id of world.query(ModuleC)) {
    const m = world.get(id, ModuleC);
    if (m && m.gridId === gridId && m.powered && m.enabled && m.hp > 0 && (defs[m.def]?.power ?? 0) > 0) return true;
  }
  return false;
}

/** Module sprites: anchored at the footprint's front tile, depth sorted, tinted by light and power, with state variants. */
export function createModuleView(world: World, atlas: Atlas, L: Layers, defs: ModuleDefs, host: ModuleViewHost): ModuleView {
  const mods = new Map<number, Entry>();
  const lastProgress = new Map<number, { value: number; at: number }>();

  function dropEntry(e: Entry): void {
    for (const p of e.parts) {
      p.spr.destroy();
      p.glow?.destroy();
      p.halo?.destroy();
      p.under?.destroy();
    }
  }

  function makePart(s: StaticSprite, tx: number, ty: number, flip: boolean, key: number, art = 0xffffff, glowKey = key + 0.01, haloUnder = false): Part {
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
    const spr = mk(s.tex);
    spr.zIndex = key;
    L.sorted.addChild(spr);
    let glow: Sprite | null = null;
    let halo: Sprite | null = null;
    let under: Container | null = null;
    if (s.glow) {
      glow = mk(s.glow);
      glow.blendMode = 'add';
      glow.zIndex = glowKey;
      L.sorted.addChild(glow);
      if (L.halos) {
        halo = mk(s.glow);
        if (haloUnder) (under = L.haloAt(glowKey)).addChild(halo);
        else L.halo.addChild(halo);
      }
    }
    const x0 = flip ? x - w : x;
    return { spr, glow, halo, under, rect: { x0, y0: y, x1: x0 + w, y1: y + h }, key, flip, art };
  }

  function build(m: Module, def: ModuleDefs[string], layers: { layer: ModuleLayer; art: Art }[], roofed: boolean): Part[] {
    const [w, h] = rotatedSize(def, m.rot);
    const [nw, nh] = def.footprint;
    const out: Part[] = [];
    layers.forEach(({ layer, art }, i) => {
      const s = art.s;
      const key = (tx: number, ty: number) => layerKey(def, m, layer, i, roofed, moduleKey(def, tx, ty));
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
      // A quarter turn of a non-square footprint without its own sprite is drawn mirrored.
      const flip = nw !== nh && m.rot % 2 === 1 && s.footprint[0] === nw && s.footprint[1] === nh;
      const k = key(m.x + w - 1, m.y + h - 1);
      out.push(makePart(s, m.x + w - 1, m.y + h - 1, flip, k, art.tint, glowKey(layer, k), !!def.console));
    });
    return out;
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
      const light = grid.raw('light');
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || m.gridId !== grid.id) continue;
        const on = m.powered && m.enabled && m.hp > 0;
        const active = showsActive(def, on, !!def.crafting && crafting(progress, id, now), manned.has(id));
        const roofed = host.roofed();
        const layers = moduleLayers(world, id, m, def, active, true).flatMap((layer) => {
          if (roofed && layer.tiles !== 'hull' && !(def.hullEdge && layer.tiles === 'rest')) return [];
          const art = resolveArt(atlas, layer.chain, layer.key);
          return art ? [{ layer, art }] : [];
        });
        if (!layers.length) continue;
        live.add(id);
        const sig = `${m.def}|${m.x}|${m.y}|${m.rot}|${roofed ? 1 : 0}|${layers.map((l) => l.art.s.tex.uid).join(',')}`;
        let e = mods.get(id);
        if (e && e.sig !== sig) {
          dropEntry(e);
          e = undefined;
        }
        if (!e) mods.set(id, (e = { sig, parts: build(m, def, layers, roofed) }));
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let lsum = 0;
        for (const f of tiles) lsum += grid.inBounds(f.x, f.y) ? (light[f.y * grid.width + f.x] as number) : 0;
        const base = lightTint(lsum / Math.max(1, tiles.length), false, pulse);
        const tint = on ? base : dim(mulColor(base, 0xc8c8d4), 0.78);
        for (const p of e.parts) {
          p.spr.tint = mulColor(tint, p.art);
          for (const g of [p.glow, p.halo]) if (g) g.visible = on;
        }
      }
    }
    for (const [id, e] of mods) {
      if (live.has(id)) continue;
      dropEntry(e);
      mods.delete(id);
    }
  }

  return {
    update,
    pick(ax, ay) {
      let best: number | null = null;
      let bestKey = -Infinity;
      for (const [id, e] of mods)
        for (const p of e.parts)
          if (ax >= p.rect.x0 && ax < p.rect.x1 && ay >= p.rect.y0 && ay < p.rect.y1 && p.key > bestKey) {
            const tex = p.spr.texture;
            const a = alphaOf(tex);
            const u = Math.floor(p.flip ? p.rect.x1 - ax : ax - p.rect.x0);
            const v = Math.floor(ay - p.rect.y0);
            if (a && (a[v * tex.frame.width + u] as number) < 40) continue;
            bestKey = p.key;
            best = id;
          }
      return best;
    },
    dispose() {
      for (const e of mods.values()) dropEntry(e);
      mods.clear();
      lastProgress.clear();
    },
  };
}
