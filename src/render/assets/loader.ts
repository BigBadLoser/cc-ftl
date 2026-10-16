import { Assets, Rectangle, Texture } from 'pixi.js';
import { MANIFEST_VERSION, type LayerAsset, type Manifest, type StaticAsset } from './manifest';

/** Base URL of the asset folder. `VITE_ASSET_BASE` only relocates it (used to point at a fixture). */
export function assetBase(): string {
  const env = import.meta.env.VITE_ASSET_BASE as string | undefined;
  const base = env ?? `${import.meta.env.BASE_URL}assets/`;
  return base.endsWith('/') ? base : `${base}/`;
}

export interface StaticSprite {
  tex: Texture;
  glow: Texture | null;
  /** Anchor in art px inside the frame. */
  ax: number;
  ay: number;
  footprint: [number, number];
}

export interface LayerSprite {
  def: LayerAsset;
  frame(dir: number, col: number): Texture;
  glowFrame(dir: number, col: number): Texture | null;
}

export interface Atlas {
  readonly manifest: Manifest;
  /** Static asset by id, or undefined if the manifest lacks it. */
  stat(id: string): StaticSprite | undefined;
  /** First static asset that exists among the ids (fallback chains). */
  firstOf(ids: readonly string[]): StaticSprite | undefined;
  layer(id: string): LayerSprite | undefined;
  /** Sorted ids of all assets starting with a prefix. */
  ids(prefix: string): string[];
}

function validate(m: Manifest): void {
  if (!m || m.version !== MANIFEST_VERSION || !m.assets || Array.isArray(m.assets) || !m.sheets) {
    throw new Error(`Asset manifest is not version ${MANIFEST_VERSION} (expected assets/sheets maps). Run the sprite pipeline.`);
  }
}

export async function loadAtlas(base = assetBase()): Promise<Atlas> {
  const res = await fetch(`${base}manifest.json`);
  if (!res.ok) throw new Error(`Cannot load ${base}manifest.json (${res.status})`);
  const manifest = (await res.json()) as Manifest;
  validate(manifest);

  const sheets = new Map<string, { image: Texture; glow: Texture | null }>();
  const load = async (path: string): Promise<Texture> => {
    const t = await Assets.load<Texture>({ src: base + path, data: { scaleMode: 'nearest' } });
    t.source.scaleMode = 'nearest';
    t.source.autoGenerateMipmaps = false;
    return t;
  };
  await Promise.all(
    Object.entries(manifest.sheets).map(async ([name, def]) => {
      const [image, glow] = await Promise.all([load(def.image), def.glow ? load(def.glow) : null]);
      sheets.set(name, { image, glow });
    }),
  );

  const sub = (src: Texture, x: number, y: number, w: number, h: number): Texture =>
    new Texture({ source: src.source, frame: new Rectangle(x, y, w, h) });
  const sheet = (name: string) => {
    const s = sheets.get(name);
    if (!s) throw new Error(`Manifest references unknown sheet "${name}"`);
    return s;
  };

  const statics = new Map<string, StaticSprite>();
  const layers = new Map<string, LayerSprite>();
  const cache = new Map<string, Texture>();

  const makeStatic = (a: StaticAsset): StaticSprite => {
    const s = sheet(a.sheet);
    const { x, y, w, h } = a.frame;
    return {
      tex: sub(s.image, x, y, w, h),
      glow: a.glow && s.glow ? sub(s.glow, x, y, w, h) : null,
      ax: a.anchor.x,
      ay: a.anchor.y,
      footprint: a.footprint,
    };
  };
  const makeLayer = (id: string, a: LayerAsset): LayerSprite => {
    const s = sheet(a.sheet);
    const cut = (src: Texture, tag: string, dir: number, col: number): Texture => {
      const key = `${id}|${tag}|${dir}|${col}`;
      let t = cache.get(key);
      if (!t) cache.set(key, (t = sub(src, col * a.frameW, dir * a.frameH, a.frameW, a.frameH)));
      return t;
    };
    return {
      def: a,
      frame: (dir, col) => cut(s.image, 'i', dir, col),
      glowFrame: (dir, col) => (a.glow && s.glow ? cut(s.glow, 'g', dir, col) : null),
    };
  };

  const sortedIds = Object.keys(manifest.assets).sort();
  const atlas: Atlas = {
    manifest,
    stat(id) {
      let s = statics.get(id);
      const a = manifest.assets[id];
      if (!s && a?.kind === 'static') statics.set(id, (s = makeStatic(a)));
      return s;
    },
    firstOf(ids) {
      for (const id of ids) {
        const s = atlas.stat(id);
        if (s) return s;
      }
      return undefined;
    },
    layer(id) {
      let l = layers.get(id);
      const a = manifest.assets[id];
      if (!l && a?.kind === 'crew.layer') layers.set(id, (l = makeLayer(id, a)));
      return l;
    },
    ids: (prefix) => sortedIds.filter((id) => id.startsWith(prefix)),
  };
  return atlas;
}
