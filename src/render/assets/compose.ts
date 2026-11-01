import type { AssetDef, LayerAsset, Manifest, SheetDef, StaticAsset } from './manifest';

/**
 * Turns the pipeline's manifest into the one the renderer reads, in WORLD pixels: the tile is `worldW` wide (128). The
 * art is drawn at half resolution (64 px tile), so it is multiplied by 2 here (frames, anchors, cell offsets, muzzles,
 * heights) and its sheets get `resolution` 0.5, so a texture cut at the scaled frame covers the same world area; every
 * other part of the renderer then needs no knowledge of the art's pixel size. Sheet paths get the art directory in front.
 */

const r1 = (n: number): number => Math.round(n * 1000) / 1000;

/** `m` (in directory `dir` under assets/) in world px: paths under `dir`, geometry multiplied by `worldW / m.tile.w`. */
export function composeManifest(m: Manifest, dir: string, worldW = 128): Manifest {
  const k = worldW / m.tile.w;
  const sheets: Record<string, SheetDef> = {};
  for (const [name, s] of Object.entries(m.sheets)) {
    sheets[name] = { image: `${dir}/${s.image}`, ...(s.glow ? { glow: `${dir}/${s.glow}` } : {}), resolution: 1 / k };
  }
  const mul = (n: number): number => n * k;
  const pt = (p: [number, number]): [number, number] => [r1(p[0] * k), r1(p[1] * k)];
  const assets: Record<string, AssetDef> = {};
  for (const [id, a] of Object.entries(m.assets)) {
    if (a.kind === 'static') {
      const o: StaticAsset = {
        ...a,
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
          ...(c.cw !== undefined ? { cw: mul(c.cw) } : {}),
          ...(c.ch !== undefined ? { ch: mul(c.ch) } : {}),
          ...(c.ox !== undefined ? { ox: mul(c.ox) } : {}),
          ...(c.oy !== undefined ? { oy: mul(c.oy) } : {}),
          ...(c.muzzle ? { muzzle: c.muzzle.map((row) => row.map(pt)) } : {}),
        };
      }
      assets[id] = { ...a, frameW: a.frameW * k, frameH: a.frameH * k, anchor: { x: a.anchor.x * k, y: a.anchor.y * k }, clips };
    }
  }
  const heights = m.heights ? { wall: m.heights.wall, roof: m.heights.roof, zPx: r1(m.heights.zPx * k) } : undefined;
  return { version: m.version, tile: { w: worldW, h: worldW / 2 }, keyColors: m.keyColors, ...(heights ? { heights } : {}), sheets, assets };
}
