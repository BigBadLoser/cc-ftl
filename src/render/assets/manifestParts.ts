import type { AssetDef, Manifest, SheetDef } from './manifest';

/**
 * The shipped manifest is split on disk (tools/blender/sprites/manifest_io.py writes it, and this mirrors its `assemble`):
 * `manifest.json` is the index (version, tile, keyColors, heights and the `parts` list) and `manifest/<part>.json` holds one
 * sprite family's sheets and assets, so rebuilding a family rewrites only its own small file.
 */
export interface ManifestIndex extends Omit<Manifest, 'sheets' | 'assets'> {
  parts: string[];
}
export interface ManifestPart {
  sheets: Record<string, SheetDef>;
  assets: Record<string, AssetDef>;
}

export const PARTS_DIR = 'manifest';

/** URL of a part file, given the URL of the index. */
export function partUrl(indexUrl: string, part: string): string {
  return `${indexUrl.slice(0, indexUrl.lastIndexOf('/') + 1)}${PARTS_DIR}/${part}.json`;
}

const sorted = <T>(m: Record<string, T>): Record<string, T> => Object.fromEntries(Object.entries(m).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The whole manifest again, sheets and assets sorted by key (the order the single file had). */
export function assembleManifest(index: ManifestIndex, parts: Readonly<Record<string, ManifestPart>>): Manifest {
  const { parts: names, ...head } = index;
  const sheets: Record<string, SheetDef> = {};
  const assets: Record<string, AssetDef> = {};
  for (const name of names) {
    const p = parts[name];
    if (!p) throw new Error(`Asset manifest part ${name} is missing`);
    Object.assign(sheets, p.sheets);
    Object.assign(assets, p.assets);
  }
  return { ...head, sheets: sorted(sheets), assets: sorted(assets) };
}

export async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Cannot load ${url} (${res.status})`);
  return res.json();
}

/** Read the index and then every part (in parallel) with `getJson`; the manifest they make. */
export async function readManifest(indexUrl: string, getJson: (url: string) => Promise<unknown>): Promise<Manifest> {
  const index = (await getJson(indexUrl)) as ManifestIndex;
  if (!index || !Array.isArray(index.parts)) throw new Error(`Asset manifest ${indexUrl} has no parts list. Run the sprite pipeline.`);
  const loaded = await Promise.all(index.parts.map(async (p) => [p, (await getJson(partUrl(indexUrl, p))) as ManifestPart] as const));
  return assembleManifest(index, Object.fromEntries(loaded));
}
