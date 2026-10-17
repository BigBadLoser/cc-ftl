import { Sprite, type Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { Grid } from '../sim/grid';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import { iso, depthKey } from './iso';
import type { Layers } from './layers';
import { dim, lightTint, mulColor, pulsePhase } from './lightTint';
import { resolveArt } from './assets/fallback';
import { craftProgress, moduleAssets } from './moduleArt';

export type ModuleDefs = Readonly<Record<string, ModuleDef>>;

export interface ModuleViewHost {
  target(): { grid: Grid } | null;
  /** True when the ship has no running power source (emergency lighting). */
  emergency(): boolean;
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
  halo: Sprite | null;
  /** Art-px rectangle the sprite covers. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  key: number;
  flip: boolean;
}
interface Entry {
  sig: string;
  /** Multiply tint of stand-in art (white for real art). */
  art: number;
  parts: Part[];
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
    }
  }

  function makePart(s: StaticSprite, tx: number, ty: number, flip: boolean, key: number): Part {
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
    if (s.glow) {
      glow = mk(s.glow);
      glow.blendMode = 'add';
      glow.zIndex = key + 0.01;
      L.sorted.addChild(glow);
      if (L.halos) L.halo.addChild((halo = mk(s.glow)));
    }
    const x0 = flip ? x - w : x;
    return { spr, glow, halo, rect: { x0, y0: y, x1: x0 + w, y1: y + h }, key, flip };
  }

  function build(m: Module, def: ModuleDefs[string], s: StaticSprite): Part[] {
    const [w, h] = rotatedSize(def, m.rot);
    const [nw, nh] = def.footprint;
    // A quarter turn of a non-square footprint without its own sprite is drawn mirrored.
    const flip = nw !== nh && m.rot % 2 === 1 && s.footprint[0] === nw && s.footprint[1] === nh;
    const key = (tx: number, ty: number) => depthKey(tx, ty) - (def.solid ? 0.05 : 0.5);
    return [makePart(s, m.x + w - 1, m.y + h - 1, flip, key(m.x + w - 1, m.y + h - 1))];
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
      const { grid } = t;
      const emergency = host.emergency();
      const pulse = emergency ? pulsePhase(now) : -1;
      const light = grid.raw('light');
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || m.gridId !== grid.id) continue;
        const art = resolveArt(atlas, moduleAssets(world, id, m, def, m.powered && m.enabled && crafting(progress, id, now)), def.asset);
        if (!art) continue;
        const asset = art.s;
        live.add(id);
        const sig = `${m.def}|${m.x}|${m.y}|${m.rot}|${asset.tex.uid}`;
        let e = mods.get(id);
        if (e && e.sig !== sig) {
          dropEntry(e);
          e = undefined;
        }
        if (!e) mods.set(id, (e = { sig, art: art.tint, parts: build(m, def, asset) }));
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let lsum = 0;
        for (const f of tiles) lsum += grid.inBounds(f.x, f.y) ? (light[f.y * grid.width + f.x] as number) : 0;
        const on = m.powered && m.enabled && m.hp > 0;
        const base = lightTint(lsum / Math.max(1, tiles.length), false, pulse);
        const tint = mulColor(on ? base : dim(mulColor(base, 0xc8c8d4), 0.78), e.art);
        for (const p of e.parts) {
          p.spr.tint = tint;
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
