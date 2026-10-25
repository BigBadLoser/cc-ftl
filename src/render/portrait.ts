import { Container, Rectangle, Sprite, Texture, type ExtractSystem } from 'pixi.js';
import type { World } from '../sim/ecs';
import type { ItemDef } from '../sim/registry';
import { CrewC } from '../sim/crew/components';
import { EquipC } from '../sim/fight/components';
import type { Atlas, LayerSprite } from './assets/loader';
import { cellOf } from './assets/manifest';
import { createCrewFilter, crewPalette, setFilterTint, setFilterZoom } from './assets/palette';
import { crewLoadout, singleBody } from './loadout';
import { cropRect, PORTRAIT_CLIP, PORTRAIT_DIR, portraitKey } from './portraitMath';

/** World px per art px; the crew filter's zoom for that (a camera scale of 1). */
const WORLD_PER_ART = 2;

export interface Portraits {
  /**
   * The portrait of a crew member as a canvas of whole art px (head and shoulders of the real layered sprite, same palette
   * swap as in the world), or null while its sheets load (they are queued). The same canvas is returned until the look
   * changes. This is the one place a portrait's pixels come from, so a higher-resolution source can replace it.
   */
  source(id: number): HTMLCanvasElement | null;
  /** The same as a PNG data URL (cached with the canvas), for an <img>. */
  url(id: number): string | null;
}

const FRONT_DIR = `${import.meta.env.BASE_URL}portraits-proto/`;
const frontImgs = new Map<string, HTMLImageElement | 'none' | undefined>();
/** A portrait render image: loads on first ask ('wait'); 'none' when the file is missing (glow twins mostly). */
function frontImage(file: string): HTMLImageElement | 'wait' | 'none' {
  const hit = frontImgs.get(file);
  if (hit) return hit === 'none' ? 'none' : hit.complete && hit.naturalWidth ? hit : 'wait';
  if (frontImgs.has(file)) return 'wait';
  frontImgs.set(file, undefined);
  const img = new Image();
  img.onload = () => frontImgs.set(file, img);
  img.onerror = () => frontImgs.set(file, 'none');
  img.src = FRONT_DIR + file;
  return 'wait';
}

export function createPortraits(extract: ExtractSystem, atlas: Atlas, world: World, items: Readonly<Record<string, ItemDef>>): Portraits {
  const cache = new Map<string, { canvas: HTMLCanvasElement; url: string }>();

  function build(id: number): { key: string; layers: LayerSprite[]; seed: number } | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    const art = items[world.get(id, EquipC)?.weapon ?? '']?.hand?.art;
    const layers = crewLoadout(atlas, crew, false, art);
    return layers.length ? { key: portraitKey(crew.species, crew.role, crew.appearanceSeed, art?.id), layers, seed: crew.appearanceSeed } : null;
  }

  /** Fallback (robots, creatures: no portrait renders yet): a crop of the isometric figure. */
  function isoSource(id: number): { canvas: HTMLCanvasElement; url: string } | null {
    const crew = world.get(id, CrewC);
    if (!crew) return null;
    const art = items[world.get(id, EquipC)?.weapon ?? '']?.hand?.art;
    const key = portraitKey(crew.species, crew.role, crew.appearanceSeed, art?.id);
    const hit = cache.get(key);
    if (hit) return hit;
    const b = build(id);
    if (!b) return null;
    // Every worn layer needs its idle sheet; ask for them and wait.
    const drawn: { layer: LayerSprite; sprite: Sprite }[] = [];
    let ready = true;
    for (const layer of b.layers) {
      const clip = layer.def.clips[PORTRAIT_CLIP];
      if (!clip) continue;
      const tex = layer.frame(clip, PORTRAIT_DIR, clip.start);
      if (!tex) { ready = false; continue; }
      const cell = cellOf(layer.def, clip);
      const sprite = new Sprite(tex);
      sprite.position.set(cell.ox - layer.def.anchor.x, cell.oy - layer.def.anchor.y);
      drawn.push({ layer, sprite });
    }
    if (!ready || !drawn.length) return null;
    const body = drawn[0] as { layer: LayerSprite; sprite: Sprite };
    const bc = cellOf(body.layer.def, body.layer.def.clips[PORTRAIT_CLIP] as never);
    const rect = cropRect({ ox: bc.ox, oy: bc.oy, w: bc.w, h: bc.h, ax: body.layer.def.anchor.x, ay: body.layer.def.anchor.y }, !singleBody(atlas, crew));
    const root = new Container();
    for (const d of drawn) root.addChild(d.sprite);
    for (const { layer } of drawn) {
      const clip = layer.def.clips[PORTRAIT_CLIP];
      const glow = layer.def.glow && clip ? layer.glowFrame(clip, PORTRAIT_DIR, clip.start) : null;
      if (!glow || !clip) continue;
      const g = new Sprite(glow);
      g.blendMode = 'add';
      const cell = cellOf(layer.def, clip);
      g.position.set(cell.ox - layer.def.anchor.x, cell.oy - layer.def.anchor.y);
      root.addChild(g);
    }
    const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(b.seed));
    setFilterZoom(filter, WORLD_PER_ART);
    setFilterTint(filter, 0xffffff);
    root.filters = [filter];
    const full = extract.canvas({ target: root, frame: new Rectangle(rect.x, rect.y, rect.w, rect.h), resolution: 1, antialias: false }) as HTMLCanvasElement;
    root.destroy({ children: true });
    filter.destroy();
    // Down to whole art px: the world draws each as a WORLD_PER_ART block.
    const out = document.createElement('canvas');
    out.width = rect.w / WORLD_PER_ART;
    out.height = rect.h / WORLD_PER_ART;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(full, 0, 0, full.width, full.height, 0, 0, out.width, out.height);
    const entry = { canvas: out, url: out.toDataURL() };
    cache.set(key, entry);
    return entry;
  }

  const ids = new Map<unknown, string>();
  for (const [id, a] of Object.entries(atlas.manifest.assets)) ids.set(a, id);

  /** Front-facing Blender portrait renders (portrait_build.py): one image per layer, all in one frame. */
  function frontSource(id: number): { canvas: HTMLCanvasElement; url: string } | null {
    const crew = world.get(id, CrewC);
    if (!crew || singleBody(atlas, crew)) return null;
    const art = items[world.get(id, EquipC)?.weapon ?? '']?.hand?.art;
    const key = 'front|' + portraitKey(crew.species, crew.role, crew.appearanceSeed, art?.id);
    const hit = cache.get(key);
    if (hit) return hit;
    const layers = crewLoadout(atlas, crew, false, art).filter((l) => l.def.slot !== 'gear.hand');
    const want = layers.map((l) => ids.get(l.def)).filter((x): x is string => !!x);
    const imgs = want.map((w) => frontImage(w + '.png'));
    const glowOf = want.filter((w) => (atlas.manifest.assets[w] as { glow?: boolean } | undefined)?.glow).map((w) => frontImage(w + '.glow.png'));
    if (imgs.some((i) => i === 'wait') || glowOf.some((i) => i === 'wait')) return null;
    const sprites = imgs.filter((i): i is HTMLImageElement => i !== 'wait' && i !== 'none').map((i) => new Sprite(Texture.from(i)));
    if (!sprites.length) return null;
    const root = new Container();
    root.addChild(...sprites);
    for (const g of glowOf) {
      if (g === 'wait' || g === 'none') continue;
      const sp = new Sprite(Texture.from(g));
      sp.blendMode = 'add';
      root.addChild(sp);
    }
    const img0 = imgs.find((i): i is HTMLImageElement => i !== 'wait' && i !== 'none') as HTMLImageElement;
    const filter = createCrewFilter(atlas.manifest.keyColors, crewPalette(crew.appearanceSeed));
    setFilterZoom(filter, 1);
    setFilterTint(filter, 0xffffff);
    root.filters = [filter];
    const canvas = extract.canvas({ target: root, frame: new Rectangle(0, 0, img0.naturalWidth, img0.naturalHeight), resolution: 1, antialias: false }) as HTMLCanvasElement;
    root.destroy({ children: true });
    filter.destroy();
    const entry = { canvas, url: canvas.toDataURL() };
    cache.set(key, entry);
    return entry;
  }

  const source = (id: number) => frontSource(id) ?? isoSource(id);
  return { source: (id) => source(id)?.canvas ?? null, url: (id) => source(id)?.url ?? null };
}
