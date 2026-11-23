import type { Manifest } from '../../src/render/assets/manifest';
import { assembleManifest, PARTS_DIR, type ManifestIndex, type ManifestPart } from '../../src/render/assets/manifestParts';

const PREFIX = '../../public/assets/';
const files = import.meta.glob(['../../public/assets/*/manifest.json', '../../public/assets/*/manifest/*.json'], { eager: true, import: 'default' }) as Record<string, unknown>;

/** The parsed JSON of a shipped manifest file by its path under public/assets (`1x/manifest.json`, `1x/manifest/hull.json`), or undefined. */
export function shippedFile(path: string): unknown {
  return files[PREFIX + path];
}

/** The shipped manifest of an art set (`1x`), whole: the index and every part file. */
export function shippedManifest(dir = '1x'): Manifest {
  const index = shippedFile(`${dir}/manifest.json`) as ManifestIndex;
  return assembleManifest(index, Object.fromEntries(index.parts.map((p) => [p, shippedFile(`${dir}/${PARTS_DIR}/${p}.json`) as ManifestPart])));
}
