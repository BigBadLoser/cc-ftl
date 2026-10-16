import { Sprite, type Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import { ItemStackC } from '../sim/items/components';
import type { Grid } from '../sim/grid';
import { ModuleC, type Module } from '../sim/modules/components';
import { footprintTiles, rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import type { Atlas, StaticSprite } from './assets/loader';
import { itemColor } from './itemColors';
import { iso, depthKey } from './iso';
import type { Layers } from './layers';
import { dim, lightTint, mulColor, pulsePhase } from './lightTint';

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

/** TODO: dedicated sprites. Stand-ins for modules whose asset is not in the manifest yet. */
const FALLBACK: Record<string, string> = { 'module.fabricator': 'module.console', 'module.storage': 'prop.crate' };

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
  parts: Part[];
}

/** True if any enabled power source of the grid is running. */
export function shipHasPower(world: World, defs: ModuleDefs, gridId: number): boolean {
  for (const id of world.query(ModuleC)) {
    const m = world.get(id, ModuleC);
    if (m && m.gridId === gridId && m.powered && m.enabled && m.hp > 0 && (defs[m.def]?.power ?? 0) > 0) return true;
  }
  return false;
}

/** Module sprites (anchored at the footprint's front tile, depth sorted, tinted by light and power) and floor item stacks. */
export function createModuleView(world: World, atlas: Atlas, L: Layers, defs: ModuleDefs, host: ModuleViewHost): ModuleView {
  const mods = new Map<number, Entry>();
  const items = new Map<number, Sprite>();
  const crate = atlas.stat('prop.crate');

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

  function build(m: Module, def: ModuleDefs[string]): Part[] {
    const chain = [def.asset, FALLBACK[def.asset] ?? ''].filter(Boolean);
    const s = atlas.firstOf(chain);
    if (!s) return [];
    const [w, h] = rotatedSize(def, m.rot);
    const [nw, nh] = def.footprint;
    // TODO: rotated sprites. A quarter turn of a non-square footprint is drawn mirrored; the rest unrotated.
    const flip = nw !== nh && m.rot % 2 === 1;
    const key = (tx: number, ty: number) => depthKey(tx, ty) - (def.solid ? 0.05 : 0.5);
    const fallback = s !== atlas.stat(def.asset);
    const tiles = footprintTiles(def, m.x, m.y, m.rot);
    if (fallback && tiles.length > 1 && s.footprint[0] * s.footprint[1] === 1)
      return tiles.map((t) => makePart(s, t.x, t.y, false, key(t.x, t.y)));
    return [makePart(s, m.x + w - 1, m.y + h - 1, flip, key(m.x + w - 1, m.y + h - 1))];
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    const liveItems = new Set<number>();
    if (t) {
      const { grid } = t;
      const emergency = host.emergency();
      const pulse = emergency ? pulsePhase(performance.now()) : -1;
      const light = grid.raw('light');
      for (const id of world.query(ModuleC)) {
        const m = world.get(id, ModuleC);
        const def = m && defs[m.def];
        if (!m || !def || m.gridId !== grid.id) continue;
        live.add(id);
        const sig = `${m.def}|${m.x}|${m.y}|${m.rot}`;
        let e = mods.get(id);
        if (e && e.sig !== sig) {
          dropEntry(e);
          e = undefined;
        }
        if (!e) mods.set(id, (e = { sig, parts: build(m, def) }));
        const tiles = footprintTiles(def, m.x, m.y, m.rot);
        let lsum = 0;
        for (const f of tiles) lsum += grid.inBounds(f.x, f.y) ? (light[f.y * grid.width + f.x] as number) : 0;
        const on = m.powered && m.enabled && m.hp > 0;
        const base = lightTint(lsum / Math.max(1, tiles.length), false, pulse);
        const tint = on ? base : dim(mulColor(base, 0xc8c8d4), 0.78);
        for (const p of e.parts) {
          p.spr.tint = tint;
          for (const g of [p.glow, p.halo]) if (g) g.visible = on;
        }
      }
      for (const id of world.query(ItemStackC)) {
        const st = world.get(id, ItemStackC);
        if (!st || st.gridId !== grid.id || !crate) continue;
        liveItems.add(id);
        let spr = items.get(id);
        if (!spr) {
          spr = new Sprite(crate.tex);
          spr.alpha = 1;
          items.set(id, spr);
          L.sorted.addChild(spr);
        }
        const p = iso(st.x, st.y);
        const sc = 0.34 + 0.16 * Math.min(1, st.count / 100);
        spr.scale.set(sc);
        spr.position.set(Math.round(p.x - crate.ax * sc), Math.round(p.y - crate.ay * sc));
        spr.zIndex = depthKey(st.x, st.y) - 0.4;
        const lv = grid.inBounds(st.x, st.y) ? (light[st.y * grid.width + st.x] as number) : 0;
        spr.tint = mulColor(itemColor(st.item), lightTint(lv, false, pulse));
      }
    }
    for (const [id, e] of mods) {
      if (live.has(id)) continue;
      dropEntry(e);
      mods.delete(id);
    }
    for (const [id, s] of items) {
      if (liveItems.has(id)) continue;
      s.destroy();
      items.delete(id);
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
      for (const s of items.values()) s.destroy();
      mods.clear();
      items.clear();
    },
  };
}
