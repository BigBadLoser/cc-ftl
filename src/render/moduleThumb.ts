import { Container, Rectangle, Sprite, Texture, type ExtractSystem } from 'pixi.js';
import { World } from '../sim/ecs';
import type { Module } from '../sim/modules/components';
import { rotatedSize } from '../sim/modules/footprint';
import type { ModuleDef } from '../sim/registry';
import { resolveArt } from './assets/fallback';
import type { Atlas } from './assets/loader';
import { iso } from './iso';
import { moduleLayers } from './moduleArt';
import { turretStem } from './turretView';

/** A module's art as one cached image (a PNG data URL, in world px) with the pixel of its front footprint tile's centre (the sprite anchor). */
export interface ModuleThumb {
  url: string;
  w: number;
  h: number;
  /** Where the centre of the footprint's front tile (w-1, h-1) sits in the image. */
  ax: number;
  ay: number;
}

export interface ModuleThumbs {
  /** The thumb of a module def at a rotation, or null while its sheets load (they are queued). `w` 0 = the def has no art. */
  get(defId: string, rot: number): ModuleThumb | null;
  /** The same art as a texture (for the placement ghost), with the thumb's anchor; null while loading or without art. */
  texture(defId: string, rot: number): { tex: Texture; ax: number; ay: number } | null;
}

/**
 * Renders each module's own sprite layers (bay, machine, bell, desk front, the weapon's turret) through Pixi to a canvas, once,
 * so the build catalog and the preview show the game's art, composites and rotations included. Same layer chain as the world view.
 */
export function createModuleThumbs(extract: ExtractSystem, atlas: Atlas, defs: Readonly<Record<string, ModuleDef>>): ModuleThumbs {
  const cache = new Map<string, ModuleThumb>();
  const canvases = new Map<string, HTMLCanvasElement>();
  const textures = new Map<string, Texture>();
  const world = new World();

  function build(defId: string, rot: number, key: string): ModuleThumb | null {
    const def = defs[defId];
    if (!def) return null;
    const m: Module = { def: defId, x: 0, y: 0, rot, hp: def.maxHp, powerPriority: 3, enabled: true, powered: true, reservedBy: 0 };
    const [w, h] = rotatedSize(def, rot);
    const front = iso(w - 1, h - 1);
    const root = new Container();
    const place = (s: Sprite, ax: number, ay: number, at: { x: number; y: number }, flip: boolean) => {
      const p = iso(at.x, at.y);
      s.position.set(Math.round(p.x + (flip ? ax : -ax)), Math.round(p.y - ay));
      if (flip) s.scale.x = -1;
      root.addChild(s);
    };
    const [nw, nh] = def.footprint;
    for (const layer of moduleLayers(world, 0, m, def, false, true)) {
      const art = resolveArt(atlas, layer.chain, layer.key);
      if (!art) {
        if (atlas.loading(layer.chain)) { root.destroy({ children: true }); return null; }
        continue;
      }
      if (art.fallback) continue; // stand-ins are drawn per tile in the world; the catalog shows real art only
      const flip = !layer.at && nw !== nh && rot % 2 === 1 && art.s.footprint[0] === nw && art.s.footprint[1] === nh;
      place(new Sprite(art.s.tex), art.s.ax, art.s.ay, layer.at ?? { x: w - 1, y: h - 1 }, flip);
    }
    if (def.weapon || def.pointDefense) {
      const t = resolveArt(atlas, [`turret.${turretStem(def.asset)}.d0`]);
      if (!t && atlas.loading([`turret.${turretStem(def.asset)}.d0`])) { root.destroy({ children: true }); return null; }
      if (t && !t.fallback) place(new Sprite(t.s.tex), t.s.ax, t.s.ay, { x: (w - 1) / 2, y: (h - 1) / 2 }, false);
    }
    let out: ModuleThumb = { url: '', w: 0, h: 0, ax: 0, ay: 0 };
    if (root.children.length) {
      const b = root.getLocalBounds();
      const frame = new Rectangle(Math.floor(b.x), Math.floor(b.y), Math.ceil(b.width) + 1, Math.ceil(b.height) + 1);
      const canvas = extract.canvas({ target: root, frame, resolution: 1, antialias: false }) as HTMLCanvasElement;
      canvases.set(key, canvas);
      out = { url: canvas.toDataURL(), w: frame.width, h: frame.height, ax: front.x - frame.x, ay: front.y - frame.y };
    }
    root.destroy({ children: true });
    return out;
  }

  return {
    get(defId, rot) {
      const key = `${defId}|${rot}`;
      const hit = cache.get(key);
      if (hit) return hit;
      const made = build(defId, rot, key);
      if (made) cache.set(key, made);
      return made;
    },
    texture(defId, rot) {
      const t = this.get(defId, rot);
      const key = `${defId}|${rot}`;
      const canvas = canvases.get(key);
      if (!t || !t.w || !canvas) return null;
      let tex = textures.get(key);
      if (!tex) textures.set(key, (tex = Texture.from(canvas)));
      return { tex, ax: t.ax, ay: t.ay };
    },
  };
}
