/**
 * The starmap's sprites as Pixi textures: the colour sheet and its glow twin (the `starmap` family, listed in the asset manifest and
 * handed over as `UiStarArt` with every frame in the sheet's own pixels), loaded as nearest-filtered sources and cut into frame textures.
 * Tinted icons (owner livery) are canvas cuts with the key colours swapped (tint.ts), cached by id and colours. A Pixi `tint` multiplies
 * the whole sprite, so it cannot turn the two key colours into two owner colours; this is the same swap the old SVG path made.
 */
import { ImageSource, Rectangle, Texture } from 'pixi.js';
import type { UiStarArt } from '../../ui/starmapApi';
import { keepOnGpu } from '../assets/loader';
import { KEY_ACCENT, KEY_CLOTH, swapPixels } from './tint';

type Rgb = [number, number, number];

export interface ArtTextures {
  readonly art: UiStarArt;
  has(id: string): boolean;
  /** The frame's texture (`glow`: its twin on the glow sheet), or null if the art has no such frame. */
  frame(id: string, glow?: boolean, half?: boolean): Texture | null;
  /** The frame with its key colours swapped for the owner's. */
  tinted(id: string, cloth: Rgb, accent: Rgb, half?: boolean): Texture | null;
  /** The sheet image and a frame's rect, for the nebula bake (which draws glow frames onto a canvas). */
  glowSheet: HTMLImageElement | null;
  destroy(): void;
}

async function loadImage(src: string): Promise<{ img: HTMLImageElement; source: ImageSource }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const source = new ImageSource({ resource: img, scaleMode: 'nearest', autoGenerateMipmaps: false });
  // The view owns its sheets for as long as it lives: Pixi's texture GC must not unload them (same rule as the atlas, issue #102).
  keepOnGpu(source);
  return { img, source };
}

/** Load the sheets of `art`; resolves once both are decoded. */
export async function loadArt(art: UiStarArt): Promise<ArtTextures> {
  const [colour, glow] = await Promise.all([loadImage(art.src), art.glow ? loadImage(art.glow) : null]);
  const cuts = new Map<string, Texture>();
  const made: Texture[] = [];
  /** A canvas cut halved (a smoothed 2:1 shrink lands on exact 2x2 averages), as a nearest-filtered texture of its own. */
  const halved = (src: CanvasImageSource, sx: number, sy: number, w: number, h: number): Texture => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, w >> 1);
    c.height = Math.max(1, h >> 1);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, w, h, 0, 0, c.width, c.height);
    const t = Texture.from(c, true);
    t.source.scaleMode = 'nearest';
    made.push(t);
    return t;
  };
  const cut = (id: string, twin: boolean, half = false): Texture | null => {
    const f = art.frames[id];
    const src = twin ? glow : colour;
    if (!f || !src) return null;
    const key = `${id}|${twin ? 'g' : 'c'}${half ? 'h' : ''}`;
    let t = cuts.get(key);
    if (!t) {
      t = half ? halved(src.img, f.x, f.y, f.w, f.h) : new Texture({ source: src.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      cuts.set(key, t);
    }
    return t;
  };
  const tints = new Map<string, Texture>();
  return {
    art,
    has: (id) => !!art.frames[id],
    frame: (id, twin = false, half = false) => cut(id, twin, half),
    glowSheet: glow?.img ?? null,
    tinted(id, cloth, accent, half = false) {
      const f = art.frames[id];
      if (!f) return null;
      const key = `${id}|${cloth.join(',')}|${accent.join(',')}${half ? '|h' : ''}`;
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
        if (half) t = halved(c, 0, 0, f.w, f.h);
        else {
          t = Texture.from(c, true);
          t.source.scaleMode = 'nearest';
          made.push(t);
        }
        tints.set(key, t);
      }
      return t;
    },
    destroy() {
      for (const [k, t] of cuts) if (!k.endsWith('h')) t.destroy(false);
      for (const t of made) t.destroy(true);
      colour.source.destroy();
      glow?.source.destroy();
    },
  };
}
