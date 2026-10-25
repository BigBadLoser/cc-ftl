import { afterEach, describe, expect, it, vi } from 'vitest';
import { composeManifest } from './compose';
import { loadComposed } from './loader';
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
  const m = composeManifest(one, '1x');

  it('puts the art in world px: geometry x2, half-resolution sheets under the art directory', () => {
    const a = m.assets['a.1'] as StaticAsset;
    expect(a.frame).toEqual({ x: 20, y: 40, w: 60, h: 80 });
    expect(a.anchor).toEqual({ x: 30, y: 70 });
    expect(a.muzzle).toEqual([6, 8]);
    expect(a.sheet).toBe('s');
    expect(m.sheets.s).toEqual({ image: '1x/sprites/s.png', glow: '1x/sprites/s.glow.png', resolution: 0.5 });
    expect(m.tile).toEqual({ w: 128, h: 64 });
    expect(m.heights?.zPx).toBeCloseTo(39.1918 * 2, 3);
    const l = m.assets['crew.x'] as LayerAsset;
    expect([l.frameW, l.frameH, l.anchor]).toEqual([128, 120, { x: 64, y: 94 }]);
    expect(l.clips.walk).toMatchObject({ cw: 40, ch: 60, ox: 10, oy: 12, muzzle: [[[14, 18]]], sheet: 'c' });
  });
});

describe('the shipped art composed', () => {
  const one = load('1x');
  const c = composeManifest(one, '1x');

  it('keeps every id and puts the tile at 128x64', () => {
    expect(Object.keys(c.assets)).toEqual(Object.keys(one.assets));
    expect(c.tile).toEqual({ w: 128, h: 64 });
  });
  it('keeps every sheet an asset names, with files under the art directory', () => {
    for (const [id, a] of Object.entries(c.assets)) {
      const names = a.kind === 'static' ? [a.sheet] : [...Object.values(a.clips).map((k) => k.sheet ?? a.sheet)];
      for (const s of names) expect(c.sheets[s ?? ''], `${id} -> ${s}`).toBeDefined();
    }
    for (const [name, s] of Object.entries(c.sheets)) {
      expect(s.image.startsWith('1x/'), name).toBe(true);
      expect(s.resolution, name).toBe(0.5);
    }
  });
});

describe('loadComposed', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('loads the one manifest and composes it', async () => {
    const f = vi.fn(async (url: string) => {
      const body = raws[`../../../public/assets/${url.replace('/base/', '')}`];
      return body === undefined ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(body) as unknown };
    });
    vi.stubGlobal('fetch', f);
    const manifest = await loadComposed('/base/');
    expect(f.mock.calls.map((c) => c[0])).toEqual(['/base/1x/manifest.json']);
    const floor = manifest.assets['tile.floor.a'] as StaticAsset;
    expect(manifest.sheets[floor.sheet]?.resolution).toBe(0.5);
    expect(manifest.tile).toEqual({ w: 128, h: 64 });
  });
});
