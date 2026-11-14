import { Container, Rectangle, Sprite, Texture, type Renderer } from 'pixi.js';
import type { Atlas, StaticSprite } from './assets/loader';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from './assets/palette';
import { drawLayers } from './crewSprites';
import { ART_SCALE } from './iso';
import { crewLoadout, preloadLayers, type CrewLook } from './loadout';
import { pressSlab, type Px } from './slabPress';

/**
 * The prisoner pressed into a full slab's face (#116; the maths is slabPress.ts). Baked once per (slab sprite, prisoner look) on
 * the CPU, lazily: `face` returns null while the figure's sheets load and the bake runs (a frame or a few), so callers draw the
 * plain slab and ask again; `version` bumps when a bake lands. The cart's 12 ring frames share one face: the cart is drawn from its
 * frame-0 heading sprite's `over` texture, the face pixels alone, laid over whichever ring frame is showing (the rings never touch
 * the slab's face), so a heading bakes once, not twelve times.
 */
export interface Face {
  /** The slab sprite with its face pressed (same frame and anchor as the sprite). */
  full: Texture;
  /** Only the pressed face pixels (transparent elsewhere), same frame: lay it over any frame of the same heading. */
  over: Texture;
}

export interface SlabFaces {
  face(id: string, src: StaticSprite, look: CrewLook): Face | null;
  /** Counts baked faces: a view that cached a null answer asks again when it moves. */
  version(): number;
  dispose(): void;
}

const lookKey = (l: CrewLook): string => `${l.species}|${l.role}|${l.appearanceSeed}`;

function read(renderer: Renderer, tex: Texture): Px {
  const c = renderer.extract.canvas({ target: new Sprite(tex), resolution: 1, antialias: false }) as HTMLCanvasElement;
  const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height);
  return { w: c.width, h: c.height, d: d.data };
}

/** The prisoner's whole crew sprite (a standing idle frame facing the camera, every layer of their loadout, their palette), trimmed to its opaque pixels. */
export async function figurePx(atlas: Atlas, renderer: Renderer, look: CrewLook, dir = 5): Promise<Px> {
  const layers = crewLoadout(atlas, look);
  preloadLayers(layers);
  await atlas.whenIdle();
  const body = new Container();
  const parts = layers.map((layer) => { const sprite = new Sprite(); body.addChild(sprite); return { layer, sprite }; });
  drawLayers({ parts, glows: [] }, 'idle', dir, 0);
  await atlas.whenIdle();
  drawLayers({ parts, glows: [] }, 'idle', dir, 0);
  const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(look.appearanceSeed));
  setFilterZoom(filter, ART_SCALE);
  setFilterTint(filter, 0xffffff);
  body.filters = [filter];
  const root = new Container();
  root.addChild(body);
  const c = renderer.extract.canvas({ target: root, frame: new Rectangle(-80, -150, 160, 170), resolution: 1, antialias: false }) as HTMLCanvasElement;
  const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height);
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d.data[(y * c.width + x) * 4 + 3]! > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  root.destroy({ children: true });
  const w = Math.max(1, x1 - x0 + 1);
  const h = Math.max(1, y1 - y0 + 1);
  const out = new Uint8ClampedArray(w * h * 4);
  if (x1 >= 0) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let k = 0; k < 4; k++) out[(y * w + x) * 4 + k] = d.data[((y + y0) * c.width + x + x0) * 4 + k]!;
  return { w, h, d: out };
}

function toTexture(w: number, h: number, d: Uint8ClampedArray): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  (c.getContext('2d') as CanvasRenderingContext2D).putImageData(new ImageData(new Uint8ClampedArray(d), w, h), 0, 0);
  const tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  return tex;
}

export function createSlabFaces(atlas: Atlas, renderer: Renderer): SlabFaces {
  const faces = new Map<string, Face | 'pending' | 'none'>();
  const figures = new Map<string, Promise<Px>>();
  let ver = 0;
  let dead = false;

  async function bake(key: string, id: string, src: StaticSprite, look: CrewLook): Promise<void> {
    try {
      const lk = lookKey(look);
      let fig = figures.get(lk);
      if (!fig) figures.set(lk, (fig = figurePx(atlas, renderer, look)));
      const figure = await fig;
      if (dead) return;
      const slab = read(renderer, src.tex);
      const res = figure.w > 1 || figure.h > 1 ? pressSlab(slab, figure) : null;
      if (!res) { faces.set(key, 'none'); return; }
      const over = new Uint8ClampedArray(res.pressed.length);
      for (let i = 0; i < res.mask.length; i++) if (res.mask[i]) for (let k = 0; k < 4; k++) over[i * 4 + k] = res.pressed[i * 4 + k]!;
      faces.set(key, { full: toTexture(slab.w, slab.h, res.pressed), over: toTexture(slab.w, slab.h, over) });
      ver++;
    } catch {
      faces.set(key, 'none');
    }
  }

  return {
    face(id, src, look) {
      const key = `${id}|${lookKey(look)}`;
      const f = faces.get(key);
      if (f === undefined) {
        faces.set(key, 'pending');
        void bake(key, id, src, look);
        return null;
      }
      return typeof f === 'string' ? null : f;
    },
    version: () => ver,
    dispose() {
      dead = true;
      for (const f of faces.values()) if (typeof f !== 'string') { f.full.destroy(true); f.over.destroy(true); }
      faces.clear();
      figures.clear();
    },
  };
}
