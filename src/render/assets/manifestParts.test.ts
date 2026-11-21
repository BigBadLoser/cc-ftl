import { describe, expect, it } from 'vitest';
import { shippedManifest } from '../../../test/support/manifest';
import type { AssetDef } from './manifest';
import { assembleManifest, partUrl, readManifest, readManifestOnce, resetManifestCache, type ManifestIndex, type ManifestPart } from './manifestParts';

const stat = (sheet: string): AssetDef => ({ kind: 'static', sheet, frame: { x: 0, y: 0, w: 1, h: 1 }, anchor: { x: 0, y: 0 }, footprint: [1, 1] });
const index: ManifestIndex = { version: 1, tile: { w: 64, h: 32 }, keyColors: {}, parts: ['b', 'a'] };
const parts: Record<string, ManifestPart> = {
  a: { sheets: { a: { image: 'sprites/a.png' } }, assets: { 'z.1': stat('a'), 'm.1': stat('a') } },
  b: { sheets: { b: { image: 'sprites/b.png' } }, assets: { 'c.1': stat('b') } },
};

describe('manifest parts', () => {
  it('assembles sheets and assets sorted by key, without the parts list', () => {
    const m = assembleManifest(index, parts);
    expect(Object.keys(m.assets)).toEqual(['c.1', 'm.1', 'z.1']);
    expect(Object.keys(m.sheets)).toEqual(['a', 'b']);
    expect('parts' in m).toBe(false);
  });
  it('names a part file next to the index and fails on a missing part', () => {
    expect(partUrl('/base/1x/manifest.json', 'hull')).toBe('/base/1x/manifest/hull.json');
    expect(() => assembleManifest(index, { a: parts.a as ManifestPart })).toThrow(/part b is missing/);
  });
  it('reads the index first and then every part', async () => {
    const seen: string[] = [];
    const m = await readManifest('/x/manifest.json', async (url) => {
      seen.push(url);
      return url === '/x/manifest.json' ? index : parts[url.slice('/x/manifest/'.length, -'.json'.length)];
    });
    expect(seen).toEqual(['/x/manifest.json', '/x/manifest/b.json', '/x/manifest/a.json']);
    expect(Object.keys(m.assets)).toHaveLength(3);
  });
  it('the shipped parts assemble to the whole art set', () => {
    const m = shippedManifest();
    expect(Object.keys(m.assets).length).toBeGreaterThan(10000);
    expect(Object.keys(m.sheets).length).toBeGreaterThan(1000);
  });
});

describe('readManifestOnce', () => {
  it('reads once per index URL and forgets a failed read', async () => {
    resetManifestCache();
    let calls = 0;
    let fail = true;
    const get = async (url: string): Promise<unknown> => {
      calls++;
      if (fail) throw new Error('offline');
      return url.endsWith('manifest.json') ? index : parts[url.slice('/y/manifest/'.length, -'.json'.length)];
    };
    await expect(readManifestOnce('/y/manifest.json', get)).rejects.toThrow('offline');
    fail = false;
    const a = await readManifestOnce('/y/manifest.json', get);
    const n = calls;
    expect(await readManifestOnce('/y/manifest.json', get)).toBe(a);
    expect(calls).toBe(n);
    resetManifestCache();
  });
});
