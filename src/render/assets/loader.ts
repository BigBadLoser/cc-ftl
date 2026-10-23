import { Assets, Rectangle, Texture, type TextureSource } from 'pixi.js';
import { cellOf, MANIFEST_VERSION, type ClipDef, type LayerAsset, type Manifest, type StaticAsset } from './manifest';
import { dropHalo } from '../haloTex';
import { SheetStore, type Loaded, type SheetIO } from './sheetStore';

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
  /** Frame `col` (= clip.start + frame index) of direction `dir` in the clip's sheet; undefined while the sheet is not loaded (it is queued). */
  frame(clip: ClipDef, dir: number, col: number): Texture | undefined;
  /** Same cell of the clip's glow sheet, or null if that sheet has no glow. Only meaningful once `frame` returned a texture. */
  glowFrame(clip: ClipDef, dir: number, col: number): Texture | null;
  /** Queue the clip's sheet (no-op when loaded or on its way). */
  request(clip: ClipDef): void;
}

export interface AtlasHooks {
  /**
   * Upload a freshly loaded sheet to the GPU now (the renderer's `texture.initSource`). The atlas then closes the decoded
   * ImageBitmap, so only the GPU copy stays resident (it would otherwise be kept in memory twice). After a lost WebGL
   * context the atlas decodes the sheets again (`contextRestored`).
   */
  upload(source: TextureSource): void;
}

export interface AtlasStats {
  /** Sheets the manifest lists / ready now / queued or loading / failed. */
  sheets: number;
  ready: number;
  pending: number;
  failed: number;
  /** Load requests so far (a sheet evicted and needed again counts twice). */
  requests: number;
  /** Decoded bytes resident (width * height * 4 over loaded images and glows), total and per pool. */
  residentBytes: number;
  pools: Record<string, { resident: number; budget: number; sheets: number }>;
  generation: number;
  /** The biggest resident sheets, [name, decoded bytes]. */
  biggest: [string, number][];
}

export interface Atlas {
  readonly manifest: Manifest;
  /** Bumps whenever an environment sheet arrives or is evicted (crew clips are looked up per frame and do not count): views that cached a resolved texture re-resolve when it changes. */
  readonly generation: number;
  /** Sheets queued or loading. */
  busy(): number;
  /** Static asset by id; undefined if the manifest lacks it or its sheet is not loaded yet (it is queued). */
  stat(id: string): StaticSprite | undefined;
  /**
   * First static asset that exists among the ids (fallback chains). An id whose sheet is still loading ends the search:
   * a later id is a worse stand-in, not an alternative.
   */
  firstOf(ids: readonly string[]): StaticSprite | undefined;
  /** True if the chain's first manifest id has a sheet that is not loaded yet (so "missing" is only for now). */
  loading(ids: readonly string[]): boolean;
  layer(id: string): LayerSprite | undefined;
  /** Sorted ids of all assets starting with a prefix. */
  ids(prefix: string): string[];
  /** Filter every sheet linearly (true: for art drawn below zoom 1, so it does not shimmer) or nearest-neighbour (false: crisp). */
  setSmooth(on: boolean): void;
  /** Once per frame after drawing: frees evicted sheets and trims the crew pool to its budget. */
  tick(): void;
  /** Advance the use clock and return it: sheets used from now on are newer than the mark (see `sweepEnv`). */
  mark(): number;
  /** If the env pool is over budget, evict the env sheets nobody used since `mark` (rebuild the sprites that hold env textures first). */
  sweepEnv(mark: number): string[];
  /** True when the env pool is over its budget. */
  envOver(): boolean;
  /** True from a lost WebGL context until the sheets are back on the GPU: do not draw meanwhile. */
  readonly restoring: boolean;
  contextLost(): void;
  /** Decode and upload every loaded sheet again (the closed bitmaps cannot be re-uploaded by themselves). */
  contextRestored(): Promise<void>;
  /** Resolves when no sheet is queued or loading. */
  whenIdle(): Promise<void>;
  /** Decoded sizes and load counters (the `?hook` debug API shows them). */
  stats(): AtlasStats;
}

/** Sheets every ship draws (walls and floors, beams, the item/puff sheet, combat fx): loaded at start, never evicted. */
export const EAGER_SHEETS: readonly string[] = ['walls', 'struct', 'env', 'fx'];
/** Decoded-byte budgets (`?crewmb=` and `?envmb=` override them, in MiB). Crew clips are evicted by idle time; env sheets by `sweepEnv` (their textures live in built sprites). */
export const CREW_BUDGET = 256 * 2 ** 20;
export const ENV_BUDGET = 384 * 2 ** 20;
/** A crew sheet nobody drew with for this long may be evicted. */
export const CREW_IDLE_MS = 4000;

/** Budget in bytes, or the `?<param>=<MiB>` URL override (to try a phone-sized budget on a desktop). */
function budgetParam(param: string, dflt: number): number {
  const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get(param);
  const mb = v === null ? NaN : Number(v);
  return Number.isFinite(mb) && mb > 0 ? mb * 2 ** 20 : dflt;
}

function validate(m: Manifest): void {
  if (!m || m.version !== MANIFEST_VERSION || !m.assets || Array.isArray(m.assets) || !m.sheets) {
    throw new Error(`Asset manifest is not version ${MANIFEST_VERSION} (expected assets/sheets maps). Run the sprite pipeline.`);
  }
}

export async function loadAtlas(base = assetBase(), hooks?: AtlasHooks): Promise<Atlas> {
  const res = await fetch(`${base}manifest.json`);
  if (!res.ok) throw new Error(`Cannot load ${base}manifest.json (${res.status})`);
  const manifest = (await res.json()) as Manifest;
  validate(manifest);

  let smooth = false;
  /** Crew sheet images hold palette-swap key colours: the crew filter reads them, so they are always sampled nearest (a blend of a key with its neighbour would escape the swap). The filter's own output is what the camera smooths. */
  const isCrewImage = (path: string): boolean => path.startsWith('sprites/crew.');
  let clock = performance.now();
  const bytesOf = (t: Texture): number => t.source.pixelWidth * t.source.pixelHeight * 4;
  let restoring = false;
  /** Upload to the GPU and drop the CPU copy; not while the context is gone (the bitmap stays for the lazy upload). */
  const toGpu = (src: TextureSource): void => {
    if (!hooks || restoring) return;
    hooks.upload(src);
    (src.resource as { close?: () => void }).close?.();
  };
  const loadTex = async (path: string, keyed = false): Promise<Texture> => {
    const mode = smooth && !keyed ? 'linear' : 'nearest';
    const t = await Assets.load<Texture>({ src: base + path, data: { scaleMode: mode } });
    t.source.scaleMode = mode;
    t.source.autoGenerateMipmaps = false;
    toGpu(t.source);
    return t;
  };
  const redecode = async (url: string, src: TextureSource): Promise<void> => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    src.resource = await createImageBitmap(await res.blob());
    hooks?.upload(src);
    (src.resource as { close?: () => void }).close?.();
  };
  // Textures cut from a sheet, by sheet: dropped on eviction and destroyed when the sheet is.
  const cuts = new Map<string, Texture[]>();
  const detached = new Map<string, Texture[]>();
  const statics = new Map<string, StaticSprite>();
  const staticsOf = new Map<string, string[]>();
  const frames = new Map<string, Map<string, Texture>>();

  const io: SheetIO<Texture> = {
    async load(image, glow) {
      const [img, gl] = await Promise.all([loadTex(image, isCrewImage(image)), glow ? loadTex(glow) : null]);
      return { sheet: { image: img, glow: gl }, bytes: bytesOf(img) + (gl ? bytesOf(gl) : 0) };
    },
    unload(name, _sheet, image, glow) {
      for (const t of detached.get(name) ?? []) t.destroy(false);
      detached.delete(name);
      void Assets.unload(base + image);
      if (glow) void Assets.unload(base + glow);
    },
  };
  const store = new SheetStore<Texture>({
    io,
    pools: {
      core: { budget: Infinity },
      env: { budget: budgetParam('envmb', ENV_BUDGET) },
      crew: { budget: budgetParam('crewmb', CREW_BUDGET), idleMs: CREW_IDLE_MS },
    },
    concurrency: 4,
    now: () => clock,
    onEvict(name) {
      for (const id of staticsOf.get(name) ?? []) statics.delete(id);
      staticsOf.delete(name);
      frames.delete(name);
      const list = cuts.get(name) ?? [];
      cuts.delete(name);
      for (const t of list) dropHalo(t);
      detached.set(name, [...(detached.get(name) ?? []), ...list]);
    },
    onRestore: (name) => void detached.delete(name),
    onError: (name, err) => console.warn(`Sheet "${name}" failed to load`, err),
  });
  const eager = new Set(EAGER_SHEETS);
  for (const [name, def] of Object.entries(manifest.sheets)) {
    const pinned = eager.has(name);
    store.register(name, { image: def.image, glow: def.glow, pool: pinned ? 'core' : name.startsWith('crew.') ? 'crew' : 'env', pinned });
  }
  for (const name of EAGER_SHEETS) if (store.has(name)) store.request(name);
  await store.idle();

  const sub = (sheet: string, src: Texture, x: number, y: number, w: number, h: number): Texture => {
    const t = new Texture({ source: src.source, frame: new Rectangle(x, y, w, h) });
    let list = cuts.get(sheet);
    if (!list) cuts.set(sheet, (list = []));
    list.push(t);
    return t;
  };
  const makeStatic = (sheet: string, s: Loaded<Texture>, a: StaticAsset): StaticSprite => {
    const { x, y, w, h } = a.frame;
    return {
      tex: sub(sheet, s.image, x, y, w, h),
      glow: a.glow && s.glow ? sub(sheet, s.glow, x, y, w, h) : null,
      ax: a.anchor.x,
      ay: a.anchor.y,
      footprint: a.footprint,
    };
  };

  const layers = new Map<string, LayerSprite>();
  const makeLayer = (id: string, a: LayerAsset): LayerSprite => {
    const sheetOf = (clip: ClipDef): string => {
      const name = clip.sheet ?? a.sheet;
      if (!name) throw new Error(`Layer "${id}" has no sheet for a clip`);
      return name;
    };
    const cut = (clip: ClipDef, tag: 'i' | 'g', dir: number, col: number): Texture | null | undefined => {
      const name = sheetOf(clip);
      const s = store.get(name);
      if (!s) return undefined;
      const src = tag === 'i' ? s.image : s.glow;
      if (!src) return null;
      let m = frames.get(name);
      if (!m) frames.set(name, (m = new Map()));
      const key = `${tag}|${dir}|${col}`;
      let t = m.get(key);
      if (!t) {
        const c = cellOf(a, clip);
        m.set(key, (t = sub(name, src, col * c.w, dir * c.h, c.w, c.h)));
      }
      return t;
    };
    return {
      def: a,
      frame: (clip, dir, col) => cut(clip, 'i', dir, col) ?? undefined,
      glowFrame: (clip, dir, col) => cut(clip, 'g', dir, col) ?? null,
      request: (clip) => store.request(sheetOf(clip)),
    };
  };

  const sortedIds = Object.keys(manifest.assets).sort();
  const staticSheet = (id: string): string | undefined => {
    const a = manifest.assets[id];
    return a?.kind === 'static' ? a.sheet : undefined;
  };
  const atlas: Atlas = {
    manifest,
    get generation() {
      return store.generationOf('core', 'env');
    },
    busy: () => store.pending,
    stat(id) {
      const a = manifest.assets[id];
      if (a?.kind !== 'static') return undefined;
      const sh = store.get(a.sheet);
      if (!sh) return undefined;
      let s = statics.get(id);
      if (!s) {
        statics.set(id, (s = makeStatic(a.sheet, sh, a)));
        let l = staticsOf.get(a.sheet);
        if (!l) staticsOf.set(a.sheet, (l = []));
        l.push(id);
      }
      return s;
    },
    firstOf(ids) {
      for (const id of ids) {
        const sheet = staticSheet(id);
        if (!sheet || store.state(sheet) === 'failed') continue;
        return atlas.stat(id);
      }
      return undefined;
    },
    loading(ids) {
      for (const id of ids) {
        const sheet = staticSheet(id);
        if (!sheet || store.state(sheet) === 'failed') continue;
        return store.state(sheet) !== 'ready';
      }
      return false;
    },
    layer(id) {
      let l = layers.get(id);
      const a = manifest.assets[id];
      if (!l && a?.kind === 'crew.layer') layers.set(id, (l = makeLayer(id, a)));
      return l;
    },
    ids: (prefix) => sortedIds.filter((id) => id.startsWith(prefix)),
    setSmooth(on) {
      if (on === smooth) return;
      smooth = on;
      store.forEachReady((name, s) => {
        for (const [i, t] of [s.image, s.glow].entries()) if (t) t.source.scaleMode = on && !(i === 0 && name.startsWith('crew.')) ? 'linear' : 'nearest';
      });
    },
    get restoring() {
      return restoring;
    },
    contextLost() {
      restoring = true;
    },
    async contextRestored() {
      const jobs: Promise<void>[] = [];
      store.forEachReady((name, s) => {
        const def = manifest.sheets[name];
        if (!def) return;
        jobs.push(redecode(base + def.image, s.image.source));
        if (s.glow && def.glow) jobs.push(redecode(base + def.glow, s.glow.source));
      });
      const done = await Promise.allSettled(jobs);
      for (const d of done) if (d.status === 'rejected') console.warn('Sheet re-decode failed', d.reason);
      restoring = false;
    },
    mark() {
      clock = Math.max(performance.now(), clock + 0.001);
      return clock;
    },
    tick() {
      atlas.mark();
      store.tick();
    },
    sweepEnv: (before) => (store.over('env') ? store.sweep('env', before) : []),
    envOver: () => store.over('env'),
    whenIdle: () => store.idle(),
    stats() {
      const st = store.stats();
      return {
        sheets: Object.keys(manifest.sheets).length,
        ready: st.ready,
        pending: st.pending,
        failed: st.failed,
        requests: st.requests,
        residentBytes: Object.values(st.pools).reduce((n, p) => n + p.resident, 0),
        pools: st.pools,
        generation: store.generation,
        biggest: store.biggest(10),
      };
    },
  };
  return atlas;
}
