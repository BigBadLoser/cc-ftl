import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeManifest } from './compose';
import { budgetFactor, resolveArtScale } from './artSet';
import { budgetsFor, loadComposed, CREW_BUDGET, ENV_BUDGET } from './loader';
import type { LayerAsset, Manifest, StaticAsset } from './manifest';

const raws = import.meta.glob('../../../public/assets/*/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const load = (dir: string): Manifest => JSON.parse(raws[`../../../public/assets/${dir}/manifest.json`] as string) as Manifest;

const stat = (sheet: string, o: Partial<StaticAsset> = {}): StaticAsset => ({ kind: 'static', sheet, frame: { x: 10, y: 20, w: 30, h: 40 }, anchor: { x: 15, y: 35 }, footprint: [1, 1], ...o });
const layer = (sheet: string): LayerAsset => ({
  kind: 'crew.layer', species: 'human', slot: 'body', order: 0, frameW: 64, frameH: 60, anchor: { x: 32, y: 47 },
  clips: { walk: { sheet, start: 0, frames: 2, fps: 4, loop: true, cw: 20, ch: 30, ox: 5, oy: 6, muzzle: [[[7, 9]]] } },
});
const mk = (tile: number, assets: Manifest['assets'], sheets: string[]): Manifest => ({
  version: 1, tile: { w: tile, h: tile / 2 }, keyColors: { 'team.skin': '#ff00ff' }, heights: { wall: 1.85, roof: 2.05, zPx: 39.1918 * (tile / 64) },
  sheets: Object.fromEntries(sheets.map((s) => [s, { image: `sprites/${s}.png`, glow: `sprites/${s}.glow.png` }])), assets,
});

describe('composeManifest', () => {
  const one = mk(64, { 'a.1': stat('s', { muzzle: [3, 4] }), 'crew.x': layer('c') }, ['s', 'c']);
  const two = mk(128, { 'a.1': stat('s'), 'a.2': stat('t', { frame: { x: 0, y: 0, w: 100, h: 80 } }), 'crew.x': layer('c'), 'crew.y': layer('d') }, ['s', 't', 'c', 'd']);
  const { manifest: m, fallbacks } = composeManifest(one, '1x', two, '2x');

  it('puts the 1x set in world px: geometry x2, half-resolution sheets under the set directory', () => {
    const a = m.assets['a.1'] as StaticAsset;
    expect(a.frame).toEqual({ x: 20, y: 40, w: 60, h: 80 });
    expect(a.anchor).toEqual({ x: 30, y: 70 });
    expect(a.muzzle).toEqual([6, 8]);
    expect(m.sheets.s).toEqual({ image: '1x/sprites/s.png', glow: '1x/sprites/s.glow.png', resolution: 0.5 });
    expect(m.tile).toEqual({ w: 128, h: 64 });
    expect(m.heights?.zPx).toBeCloseTo(39.1918 * 2, 3);
    const l = m.assets['crew.x'] as LayerAsset;
    expect([l.frameW, l.frameH, l.anchor, l.px]).toEqual([128, 120, { x: 64, y: 94 }, 2]);
    expect(l.clips.walk).toMatchObject({ cw: 40, ch: 60, ox: 10, oy: 12, muzzle: [[[14, 18]]], sheet: 'c' });
  });
  it('lands a sprite on the same world point in both sets', () => {
    // Art px (ax, ay) of the frame's origin -> world position of the sprite's top-left for a given anchor point.
    const same = composeManifest(mk(128, { 'a.1': stat('s', { frame: { x: 20, y: 40, w: 60, h: 80 }, anchor: { x: 30, y: 70 } }) }, ['s']), '2x', null, '2x').manifest.assets['a.1'] as StaticAsset;
    const half = m.assets['a.1'] as StaticAsset;
    expect(half.anchor).toEqual(same.anchor);
    expect({ w: half.frame.w, h: half.frame.h }).toEqual({ w: same.frame.w, h: same.frame.h });
  });
  it('takes ids the 1x set lacks from 2x at their own scale, sheets renamed, nothing resampled', () => {
    expect(fallbacks).toEqual(['a.2', 'crew.y']);
    const b = m.assets['a.2'] as StaticAsset;
    expect(b.sheet).toBe('2x:t');
    expect(b.frame).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    expect(m.sheets['2x:t']).toEqual({ image: '2x/sprites/t.png', glow: '2x/sprites/t.glow.png', resolution: 1 });
    const y = m.assets['crew.y'] as LayerAsset;
    expect(y.px).toBe(1);
    expect(y.clips.walk?.sheet).toBe('2x:d');
    expect(y.clips.walk?.cw).toBe(20);
    expect(m.sheets['2x:d']).toBeDefined();
    // A 1x id is never replaced by its 2x twin, and its 2x sheet is not pulled in.
    expect((m.assets['a.1'] as StaticAsset).sheet).toBe('s');
    expect(m.sheets['2x:s']).toBeUndefined();
  });
  it('is the plain 2x manifest with no fallback', () => {
    const c = composeManifest(two, '2x', null, '2x');
    expect(c.fallbacks).toEqual([]);
    expect((c.manifest.assets['a.2'] as StaticAsset).frame).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    expect(c.manifest.sheets.s?.resolution).toBe(1);
  });
});

describe('the shipped sets composed', () => {
  const one = load('1x');
  const two = load('2x');
  const c1 = composeManifest(one, '1x', two, '2x');
  const c2 = composeManifest(two, '2x', null, '2x');

  it('2x composes unchanged and 1x falls back only for what the 1x render lacks', () => {
    expect(Object.keys(c2.manifest.assets)).toEqual(Object.keys(two.assets));
    expect(Object.keys(c1.manifest.assets).sort()).toEqual(Object.keys(two.assets).sort());
    expect(c1.fallbacks.length).toBe(Object.keys(two.assets).filter((id) => !one.assets[id]).length);
    for (const id of c1.fallbacks) expect(one.assets[id]).toBeUndefined();
  });
  it('puts ids both sets have on the same world point (the tile centre within the 1x pixel grid)', () => {
    let n = 0;
    for (const id of Object.keys(one.assets).filter((i) => i.startsWith('tile.floor.'))) {
      const a = c1.manifest.assets[id] as StaticAsset;
      const b = c2.manifest.assets[id] as StaticAsset;
      expect(Math.abs(a.anchor.x - b.anchor.x), id).toBeLessThanOrEqual(2);
      expect(Math.abs(a.anchor.y - b.anchor.y), id).toBeLessThanOrEqual(2);
      expect(Math.abs(a.frame.w - b.frame.w), id).toBeLessThanOrEqual(4);
      n++;
    }
    expect(n).toBeGreaterThan(0);
  });
  it('keeps every sheet an asset names, with files under its own set', () => {
    for (const [id, a] of Object.entries(c1.manifest.assets)) {
      const names = a.kind === 'static' ? [a.sheet] : [...Object.values(a.clips).map((k) => k.sheet ?? a.sheet)];
      for (const s of names) expect(c1.manifest.sheets[s ?? ''], `${id} -> ${s}`).toBeDefined();
    }
    for (const [name, s] of Object.entries(c1.manifest.sheets)) expect(s.image.startsWith(name.startsWith('2x:') ? '2x/' : '1x/'), name).toBe(true);
  });
});

describe('art set choice and budgets', () => {
  it('reads ?art= first, then the stored choice, then 1x', () => {
    expect(resolveArtScale('?art=2x', '1')).toBe(2);
    expect(resolveArtScale('?art=1x', '2')).toBe(1);
    expect(resolveArtScale('', '2')).toBe(2);
    expect(resolveArtScale('?art=banana', null)).toBe(1);
    expect(resolveArtScale('', null)).toBe(1);
  });
  it('gives 1x a quarter of every pool', () => {
    expect(budgetFactor(1)).toBe(0.25);
    expect(budgetsFor(1)).toEqual({ crew: CREW_BUDGET / 4, env: ENV_BUDGET / 4 });
    expect(budgetsFor(2)).toEqual({ crew: CREW_BUDGET, env: ENV_BUDGET });
  });
});

describe('loadComposed', () => {
  afterEach(() => vi.unstubAllGlobals());
  /** Serve the shipped manifests; `drop` takes ids out of the 1x one (an id the 1x render has not made). */
  const serve = (drop: (id: string) => boolean = () => false) =>
    vi.fn(async (url: string) => {
      let body = raws[`../../../public/assets/${url.replace('/base/', '')}`];
      if (body !== undefined && url.includes('1x/')) {
        const m = JSON.parse(body) as { assets: Record<string, unknown> };
        for (const id of Object.keys(m.assets)) if (drop(id)) delete m.assets[id];
        body = JSON.stringify(m);
      }
      return body === undefined ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(body) as unknown };
    });
  it('1x loads both manifests and an id missing from 1x resolves from the 2x set', async () => {
    const f = serve((id) => id.startsWith('rock.'));
    vi.stubGlobal('fetch', f);
    const { manifest, fallbacks } = await loadComposed('/base/', 1);
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/base/1x/manifest.json', '/base/2x/manifest.json']);
    const rock = Object.keys(manifest.assets).find((k) => k.startsWith('rock.'));
    expect(rock).toBeDefined();
    expect(fallbacks).toContain(rock);
    const a = manifest.assets[rock as string] as StaticAsset;
    expect(a.sheet.startsWith('2x:')).toBe(true);
    expect(manifest.sheets[a.sheet]?.resolution).toBe(1);
    // an id both sets have stays 1x
    const floor = manifest.assets['tile.floor.a'] as StaticAsset;
    expect(manifest.sheets[floor.sheet]?.resolution).toBe(0.5);
  });
  it('2x loads only its own manifest, and 1x without a 2x manifest simply has no fallbacks', async () => {
    const f = serve();
    vi.stubGlobal('fetch', f);
    expect((await loadComposed('/base/', 2)).fallbacks).toEqual([]);
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi.fn(async (url: string) => (url.includes('2x') ? { ok: false, status: 404, json: async () => ({}) } : serve()(url)));
    vi.stubGlobal('fetch', g);
    expect((await loadComposed('/base/', 1)).fallbacks).toEqual([]);
  });
});
