import { Container, Rectangle, Sprite, type ExtractSystem } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { ItemDef } from '../sim/registry';
import type { HandWeaponArt } from '../sim';
import { CrewC } from '../sim/crew/components';
import { EquipC } from '../sim/fight/components';
import type { Atlas, LayerSprite } from './assets/loader';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from './assets/palette';
import { ART_SCALE } from './iso';
import { crewLoadout, singleBody, type CrewLook } from './loadout';
import { artSize, portraitAssetId, portraitKey } from './portraitMath';

export interface Portraits {
  /**
   * The portrait of a crew member as a canvas of whole art px, or null while its sheet loads (it is queued). The same
   * canvas is returned until the look changes. This is the one place a portrait's pixels come from, so another source
   * (say a higher resolution one) can replace it without touching the bar.
   */
  source(id: number): HTMLCanvasElement | null;
  /** The same as a PNG data URL (cached with the canvas), for an <img>. */
  url(id: number): string | null;
  /** A portrait from a look alone (no crew entity): the lessons' instructors. PNG data URL, or null while its sheets load. */
  lookUrl(look: CrewLook): string | null;
  /** A dedicated portrait asset (manifest key: an instructor's own art) at whole art px, or null while it loads or if there is none. */
  assetUrl(key: string): string | null;
}

/**
 * Portraits are front-facing head-and-shoulders renders of every crew layer (`portrait.<layer id>` in the `portraits` sheet,
 * tools/blender/sprites/portrait_render.py), all in one frame. A portrait stacks the layers the crew member wears (the same
 * loadout as in the world, hands empty), runs the crew palette swap over them (their appearance seed's colours, like the
 * world figure) and reads the result back at whole art px.
 */
export function createPortraits(extract: ExtractSystem, atlas: Atlas, world: World, items: Readonly<Record<string, ItemDef>>): Portraits {
  const cache = new Map<string, { canvas: HTMLCanvasElement; url: string }>();
  const ids = new Map<unknown, string>();
  for (const [id, a] of Object.entries(atlas.manifest.assets)) ids.set(a, id);

  function build(id: number): { canvas: HTMLCanvasElement; url: string } | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    return compose(crew, items[world.get(id, EquipC)?.weapon ?? '']?.hand?.art);
  }

  function compose(crew: CrewLook, art: HandWeaponArt | undefined): { canvas: HTMLCanvasElement; url: string } | null {
    const key = portraitKey(crew.species, crew.role, crew.appearanceSeed, art?.id);
    const hit = cache.get(key);
    if (hit) return hit;
    const body = singleBody(atlas, crew);
    const layers: LayerSprite[] = body ? [body] : crewLoadout(atlas, crew, false, art).filter((l) => l.def.slot !== 'gear.hand');
    const root = new Container();
    let size: { w: number; h: number } | null = null;
    for (const l of layers) {
      const pid = portraitAssetId(ids.get(l.def) ?? '');
      const st = atlas.stat(pid);
      if (!st) {
        if (atlas.loading([pid])) { root.destroy({ children: true }); return null; } // its sheet is on the way
        continue; // a layer with no portrait render (it is not drawn)
      }
      size ??= { w: st.tex.width, h: st.tex.height };
      root.addChild(new Sprite(st.tex));
      if (st.glow) {
        const g = new Sprite(st.glow);
        g.blendMode = 'add';
        root.addChild(g);
      }
    }
    if (!size || !root.children.length) { root.destroy({ children: true }); return null; }
    const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(crew.appearanceSeed));
    setFilterZoom(filter, ART_SCALE); // a camera scale of 1: one art px is ART_SCALE device px
    setFilterTint(filter, 0xffffff);
    root.filters = [filter];
    const entry = toArtPx(root, size, key);
    filter.destroy();
    return entry;
  }

  /** Read a stacked container back and shrink it to whole art px (the art draws each as an ART_SCALE block); cached under `key`. Destroys `root`. */
  function toArtPx(root: Container, size: { w: number; h: number }, key: string): { canvas: HTMLCanvasElement; url: string } | null {
    const full = extract.canvas({ target: root, frame: new Rectangle(0, 0, size.w, size.h), resolution: 1, antialias: false }) as HTMLCanvasElement;
    root.destroy({ children: true });
    const px = artSize(size.w, size.h, ART_SCALE);
    const out = document.createElement('canvas');
    out.width = px.w;
    out.height = px.h;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(full, 0, 0, full.width, full.height, 0, 0, px.w, px.h);
    const entry = { canvas: out, url: out.toDataURL() };
    cache.set(key, entry);
    return entry;
  }

  function asset(key: string): { canvas: HTMLCanvasElement; url: string } | null {
    const hit = cache.get(`asset|${key}`);
    if (hit) return hit;
    const st = atlas.stat(key);
    if (!st) return null; // asking queues its sheet; an unknown key stays null and the caller falls back
    const root = new Container();
    root.addChild(new Sprite(st.tex));
    return toArtPx(root, { w: st.tex.width, h: st.tex.height }, `asset|${key}`);
  }

  return {
    source: (id) => build(id)?.canvas ?? null,
    url: (id) => build(id)?.url ?? null,
    lookUrl: (look) => compose(look, undefined)?.url ?? null,
    assetUrl: (key) => asset(key)?.url ?? null,
  };
}
