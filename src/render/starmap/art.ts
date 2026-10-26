/**
 * The starmap's sprites as Pixi textures: the colour sheet and its glow twin (the `starmap` family, listed in the asset manifest and
 * handed over as `UiStarArt` with every frame in the sheet's own pixels), loaded as nearest-filtered sources and cut into frame textures.
 * Tinted icons (owner livery) are canvas cuts with the key colours swapped (tint.ts), cached by id and colours. A Pixi `tint` multiplies
 * the whole sprite, so it cannot turn the two key colours into two owner colours; this is the same swap the old SVG path made.
 */
import { ImageSource, Rectangle, Texture } from 'pixi.js';
import type { UiStarArt } from '../../ui/starmapApi';
import { KEY_ACCENT, KEY_CLOTH, swapPixels } from './tint';

type Rgb = [number, number, number];

export interface ArtTextures {
  readonly art: UiStarArt;
  has(id: string): boolean;
  /** The frame's texture (`glow`: its twin on the glow sheet), or null if the art has no such frame. */
  frame(id: string, glow?: boolean): Texture | null;
  /** The frame with its key colours swapped for the owner's. */
  tinted(id: string, cloth: Rgb, accent: Rgb): Texture | null;
  /** The sheet image and a frame's rect, for the nebula bake (which draws glow frames onto a canvas). */
  glowSheet: HTMLImageElement | null;
  destroy(): void;
}

async function loadImage(src: string): Promise<{ img: HTMLImageElement; source: ImageSource }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return { img, source: new ImageSource({ resource: img, scaleMode: 'nearest', autoGenerateMipmaps: false }) };
}

/** Load the sheets of `art`; resolves once both are decoded. */
export async function loadArt(art: UiStarArt): Promise<ArtTextures> {
  const [colour, glow] = await Promise.all([loadImage(art.src), art.glow ? loadImage(art.glow) : null]);
  const cuts = new Map<string, Texture>();
  const made: Texture[] = [];
  const cut = (id: string, twin: boolean): Texture | null => {
    const f = art.frames[id];
    const src = twin ? glow : colour;
    if (!f || !src) return null;
    const key = `${id}|${twin ? 'g' : 'c'}`;
    let t = cuts.get(key);
    if (!t) {
      t = new Texture({ source: src.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      cuts.set(key, t);
    }
    return t;
  };
  const tints = new Map<string, Texture>();
  return {
    art,
    has: (id) => !!art.frames[id],
    frame: (id, twin = false) => cut(id, twin),
    glowSheet: glow?.img ?? null,
    tinted(id, cloth, accent) {
      const f = art.frames[id];
      if (!f) return null;
      const key = `${id}|${cloth.join(',')}|${accent.join(',')}`;
      let t = tints.get(key);
      if (!t) {
        const c = document.createElement('canvas');
        c.width = f.w;
        c.height = f.h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(colour.img, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
        const px = ctx.getImageData(0, 0, f.w, f.h);
        swapPixels(px.data, [KEY_CLOTH, KEY_ACCENT], [cloth, accent]);
        ctx.putImageData(px, 0, 0);
        t = Texture.from(c, true);
        t.source.scaleMode = 'nearest';
        tints.set(key, t);
        made.push(t);
      }
      return t;
    },
    destroy() {
      for (const t of [...cuts.values()]) t.destroy(false);
      for (const t of made) t.destroy(true);
      colour.source.destroy();
      glow?.source.destroy();
    },
  };
}
