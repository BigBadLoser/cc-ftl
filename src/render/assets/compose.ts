import type { AssetDef, LayerAsset, Manifest, SheetDef, StaticAsset } from './manifest';

/**
 * Turns the manifests of the art sets into the one manifest the renderer reads, in WORLD pixels: the tile is always
 * `worldW` wide, whatever set an asset comes from. A 1x set (64 px tile) is multiplied by 2 here (frames, anchors, cell
 * offsets, muzzles, heights), and its sheets get `resolution` 0.5, so a texture cut at the scaled frame covers the
 * same world area; every other part of the renderer then needs no knowledge of the set. Sheet paths get the set's
 * directory in front, and an asset of the fallback set that the primary lacks is added under sheet names prefixed
 * `<dir>:` (the sets' sheet names collide: both have a `walls`).
 */

export interface ComposedSet {
  manifest: Manifest;
  /** Asset ids that came from the fallback set (the primary lacks them), sorted. */
  fallbacks: string[];
}

const r1 = (n: number): number => Math.round(n * 1000) / 1000;

/** One set's manifest in world px: sheet names prefixed, paths under `dir`, geometry multiplied by `k`. */
function normalize(m: Manifest, dir: string, prefix: string, worldW: number): { sheets: Record<string, SheetDef>; assets: Record<string, AssetDef>; k: number } {
  const k = worldW / m.tile.w;
  const sheets: Record<string, SheetDef> = {};
  for (const [name, s] of Object.entries(m.sheets)) {
    sheets[prefix + name] = { image: `${dir}/${s.image}`, ...(s.glow ? { glow: `${dir}/${s.glow}` } : {}), resolution: 1 / k };
  }
  const mul = (n: number): number => n * k;
  const pt = (p: [number, number]): [number, number] => [r1(p[0] * k), r1(p[1] * k)];
  const assets: Record<string, AssetDef> = {};
  for (const [id, a] of Object.entries(m.assets)) {
    if (a.kind === 'static') {
      const o: StaticAsset = {
        ...a,
        sheet: prefix + a.sheet,
        frame: { x: a.frame.x * k, y: a.frame.y * k, w: a.frame.w * k, h: a.frame.h * k },
        anchor: { x: a.anchor.x * k, y: a.anchor.y * k },
      };
      if (a.muzzle) o.muzzle = pt(a.muzzle);
      assets[id] = o;
    } else {
      const clips: LayerAsset['clips'] = {};
      for (const [cn, c] of Object.entries(a.clips)) {
        clips[cn] = {
          ...c,
          ...(c.sheet !== undefined ? { sheet: prefix + c.sheet } : {}),
          ...(c.cw !== undefined ? { cw: mul(c.cw) } : {}),
          ...(c.ch !== undefined ? { ch: mul(c.ch) } : {}),
          ...(c.ox !== undefined ? { ox: mul(c.ox) } : {}),
          ...(c.oy !== undefined ? { oy: mul(c.oy) } : {}),
          ...(c.muzzle ? { muzzle: c.muzzle.map((row) => row.map(pt)) } : {}),
        };
      }
      assets[id] = {
        ...a,
        ...(a.sheet !== undefined ? { sheet: prefix + a.sheet } : {}),
        frameW: a.frameW * k,
        frameH: a.frameH * k,
        anchor: { x: a.anchor.x * k, y: a.anchor.y * k },
        px: k,
        clips,
      };
    }
  }
  return { sheets, assets, k };
}

/** Sheets an asset draws from. */
const sheetsOf = (a: AssetDef): string[] => (a.kind === 'static' ? [a.sheet] : [...(a.sheet ? [a.sheet] : []), ...Object.values(a.clips).flatMap((c) => (c.sheet ? [c.sheet] : []))]);

/**
 * `primary` (in directory `dir`) with every id it lacks taken from `fallback` (`fallbackDir`), at the fallback's own
 * scale. Pass no fallback for a set that is complete. Never resamples: a fallback asset keeps its own sheet.
 */
export function composeManifest(primary: Manifest, dir: string, fallback: Manifest | null, fallbackDir: string, worldW = 128): ComposedSet {
  const p = normalize(primary, dir, '', worldW);
  const assets = { ...p.assets };
  const sheets = { ...p.sheets };
  const fallbacks: string[] = [];
  if (fallback && fallbackDir !== dir) {
    const f = normalize(fallback, fallbackDir, `${fallbackDir}:`, worldW);
    for (const [id, a] of Object.entries(f.assets)) {
      if (id in assets) continue;
      assets[id] = a;
      fallbacks.push(id);
      for (const s of sheetsOf(a)) sheets[s] = f.sheets[s] as SheetDef;
    }
    fallbacks.sort();
  }
  const heights = primary.heights ? { wall: primary.heights.wall, roof: primary.heights.roof, zPx: r1(primary.heights.zPx * p.k) } : undefined;
  const manifest: Manifest = {
    version: primary.version,
    tile: { w: worldW, h: worldW / 2 },
    keyColors: primary.keyColors,
    ...(heights ? { heights } : {}),
    sheets,
    assets,
  };
  return { manifest, fallbacks };
}
