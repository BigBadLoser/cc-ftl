import { Rectangle, Sprite, Texture } from 'pixi.js';
import type { World } from '../sim/ecs';
import { JobC } from '../sim/crew/components';
import type { Grid } from '../sim/grid';
import { footprintTiles, hullRow, openTilesOf, rotatedSize } from '../sim/modules/footprint';
import type { Module } from '../sim/modules/components';
import type { Art } from './assets/fallback';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { diamondTextures } from './diamonds';
import { iso } from './iso';
import type { Layers } from './layers';
import { layerKey, moduleLayers, type ModuleLayer } from './moduleArt';
import { alphaOf, moduleKey, type ModuleDefs } from './moduleView';

/** Ghost look: a translucent cyan copy of the module's own sprite that fills in from the bottom as the work progresses. */
const GHOST = 0x7fdcff;
const GHOST_ALPHA = 0.34;
const FILL_FROM = 0xa8ecff;
const EDGE = 0x66f0ff;
const BLOCKED = 0xffb020;
/** Art px of the bright line riding the fill edge. */
const EDGE_ROWS = 2;

export interface SiteViewHost {
  /** The grid whose sites are drawn now, or null (a roofed ship hides its interior). */
  target(): { grid: Grid } | null;
}

export interface SiteView {
  update(): void;
  /** Sites stuck for a reason (amber outline) and the selected one (brighter ghost). */
  setMarks(blocked: ReadonlySet<number>, selected: number | null): void;
  /** Job id of the site whose ghost covers an art-px point, or null. */
  pick(ax: number, ay: number): number | null;
  dispose(): void;
}

interface SPart {
  tex: Texture;
  base: Sprite;
  fill: Sprite;
  edge: Sprite;
  /** Art-px rectangle of the whole sprite, and whether it is drawn mirrored. */
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
  key: number;
  art: number;
}
interface Entry {
  sig: string;
  parts: SPart[];
  top: number;
  bottom: number;
  outline: Sprite[];
}

const crops = new WeakMap<Texture, Map<string, Texture>>();
/** Rows [start, start + rows) of a sheet frame as a texture of their own (cached: the fill line moves a row at a time). */
function crop(tex: Texture, start: number, rows: number): Texture {
  let m = crops.get(tex);
  if (!m) crops.set(tex, (m = new Map()));
  const k = `${start}:${rows}`;
  let t = m.get(k);
  if (!t) m.set(k, (t = new Texture({ source: tex.source, frame: new Rectangle(tex.frame.x, tex.frame.y + start, tex.frame.width, rows) })));
  return t;
}

const lerpColor = (a: number, b: number, t: number): number => {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/** Module construction sites (blueprint jobs) drawn as ghosts of the module's real art. */
export function createSiteView(world: World, atlas: Atlas, L: Layers, defs: ModuleDefs, host: SiteViewHost): SiteView {
  const sites = new Map<number, Entry>();
  const outline = diamondTextures().outline;
  let blocked: ReadonlySet<number> = new Set();
  let selected: number | null = null;

  const drop = (e: Entry): void => {
    for (const p of e.parts) for (const s of [p.base, p.fill, p.edge]) s.destroy();
    for (const s of e.outline) s.destroy();
  };

  function part(art: Art, tx: number, ty: number, flip: boolean, key: number): SPart {
    const s = art.s;
    const p = iso(tx, ty);
    const x = Math.round(p.x + (flip ? s.ax : -s.ax));
    const y = Math.round(p.y - s.ay);
    const mk = (tex: Texture): Sprite => {
      const spr = new Sprite(tex);
      spr.position.set(x, y);
      if (flip) spr.scale.x = -1;
      L.sorted.addChild(spr);
      return spr;
    };
    const base = mk(s.tex);
    const fill = mk(s.tex);
    const edge = mk(s.tex);
    edge.blendMode = 'add';
    fill.visible = edge.visible = false;
    return { tex: s.tex, base, fill, edge, x: flip ? x - s.tex.width : x, y, w: s.tex.width, h: s.tex.height, flip, key, art: art.tint };
  }

  function build(m: Module, def: ModuleDefs[string], layers: { layer: ModuleLayer; art: Art }[]): SPart[] {
    const [w, h] = rotatedSize(def, m.rot);
    const [nw, nh] = def.footprint;
    const out: SPart[] = [];
    layers.forEach(({ layer, art }, i) => {
      const key = (tx: number, ty: number) => layerKey(def, m, layer, i, false, moduleKey(def, tx, ty));
      if (layer.at) {
        out.push(part(art, layer.at.x, layer.at.y, false, key(layer.at.x, layer.at.y)));
        return;
      }
      if (art.fallback && art.perTile) {
        // A stand-in covers the footprint tile by tile.
        const skip = new Set((layer.tiles === 'hull' ? [] : openTilesOf(def, m.x, m.y, m.rot)).map((t) => `${t.x},${t.y}`));
        const hull = new Set(hullRow(def, m.x, m.y, m.rot).map((t) => `${t.x},${t.y}`));
        for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
          const k = `${t.x},${t.y}`;
          if (skip.has(k) || (layer.tiles !== 'all' && (layer.tiles === 'hull') !== hull.has(k))) continue;
          out.push(part(art, t.x, t.y, false, key(t.x, t.y)));
        }
        return;
      }
      const flip = nw !== nh && m.rot % 2 === 1 && art.s.footprint[0] === nw && art.s.footprint[1] === nh;
      out.push(part(art, m.x + w - 1, m.y + h - 1, flip, key(m.x + w - 1, m.y + h - 1)));
    });
    return out;
  }

  function update(): void {
    const t = host.target();
    const live = new Set<number>();
    const now = performance.now();
    if (t) {
      const { grid } = t;
      for (const id of world.query(JobC)) {
        const j = world.get(id, JobC);
        const def = j?.kind === 'module' && j.module ? defs[j.module.def] : undefined;
        if (!j?.module || !def || !grid.inBounds(j.x, j.y)) continue;
        const lm = { def: j.module.def, x: j.x - grid.x0, y: j.y - grid.y0, rot: j.module.rot, hp: def.maxHp, priority: 3, enabled: true, powered: false, reservedBy: 0 } satisfies Module;
        const layers = moduleLayers(world, id, lm, def, false, true).flatMap((layer) => {
          const art = resolveArt(atlas, layer.chain, layer.key);
          return art ? [{ layer, art }] : [];
        });
        if (!layers.length) continue;
        live.add(id);
        const sig = `${lm.def}|${lm.x}|${lm.y}|${lm.rot}|${layers.map((l) => l.art.s.tex.uid).join(',')}`;
        let e = sites.get(id);
        if (e && e.sig !== sig) {
          drop(e);
          e = undefined;
        }
        if (!e) {
          const parts = build(lm, def, layers);
          const tiles = footprintTiles(def, lm.x, lm.y, lm.rot);
          const marks = tiles.map((tt) => {
            const s = new Sprite(outline);
            s.anchor.set(0.5);
            const p = iso(tt.x, tt.y);
            s.position.set(p.x, p.y);
            s.tint = BLOCKED;
            L.decal.addChild(s);
            return s;
          });
          sites.set(id, (e = { sig, parts, top: Math.min(...parts.map((p) => p.y)), bottom: Math.max(...parts.map((p) => p.y + p.h)), outline: marks }));
        }
        const frac = j.work > 0 ? Math.min(1, j.progress / j.work) : 0;
        const stuck = blocked.has(id);
        const line = Math.round(e.bottom - frac * (e.bottom - e.top));
        const pulse = 0.7 + 0.3 * Math.sin(now / 220);
        for (const p of e.parts) {
          const done = Math.max(0, Math.min(p.h, p.y + p.h - line));
          p.base.tint = stuck ? BLOCKED : GHOST;
          p.base.alpha = (id === selected ? 0.5 : GHOST_ALPHA) * (stuck ? pulse + 0.2 : 1);
          p.fill.visible = done > 0;
          if (done > 0) {
            p.fill.texture = crop(p.tex, p.h - done, done);
            p.fill.position.y = p.y + p.h - done;
            p.fill.tint = lerpColor(stuck ? BLOCKED : FILL_FROM, 0xffffff, frac);
            p.fill.alpha = 0.55 + 0.4 * frac;
          }
          // the bright line riding the fill edge
          const r0 = Math.max(0, line - EDGE_ROWS - p.y);
          const r1 = Math.min(p.h, line - p.y);
          p.edge.visible = r1 > r0 && frac < 1;
          if (p.edge.visible) {
            p.edge.texture = crop(p.tex, r0, r1 - r0);
            p.edge.position.y = p.y + r0;
            p.edge.tint = stuck ? BLOCKED : EDGE;
            p.edge.alpha = 0.9;
          }
          for (const s of [p.base, p.fill, p.edge]) s.zIndex = p.key + (s === p.fill ? 0.0001 : s === p.edge ? 0.0002 : 0);
        }
        for (const s of e.outline) {
          s.visible = stuck;
          s.alpha = pulse;
        }
      }
    }
    for (const [id, e] of sites) {
      if (live.has(id)) continue;
      drop(e);
      sites.delete(id);
    }
  }

  return {
    update,
    setMarks(b, s) {
      blocked = b;
      selected = s;
    },
    pick(ax, ay) {
      let best: number | null = null;
      let bestKey = -Infinity;
      for (const [id, e] of sites)
        for (const p of e.parts) {
          if (ax < p.x || ax >= p.x + p.w || ay < p.y || ay >= p.y + p.h || p.key <= bestKey) continue;
          const a = alphaOf(p.tex);
          const u = Math.floor(p.flip ? p.x + p.w - 1 - ax : ax - p.x);
          const v = Math.floor(ay - p.y);
          if (a && (a[v * p.tex.frame.width + u] as number) < 40) continue;
          bestKey = p.key;
          best = id;
        }
      return best;
    },
    dispose() {
      for (const e of sites.values()) drop(e);
      sites.clear();
    },
  };
}
