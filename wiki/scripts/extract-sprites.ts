import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { modules as baseModules } from '../../src/content/modules.ts';
import { tierModules } from '../../src/content/tiers.ts';
import { weapons } from '../../src/content/weapons.ts';
import { vehicles } from '../../src/content/vehicles.ts';
import { items } from '../../src/content/items.ts';
import type { Manifest, StaticAsset } from '../../src/render/assets/manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetsRoot = resolve(root, '../public/assets/1x');
const target = join(root, 'static/generated/sprites');
const manifest = JSON.parse(await readFile(join(assetsRoot, 'manifest.json'), 'utf8')) as Manifest;
if (manifest.version !== 1) throw Error('Unsupported sprite manifest version: ' + manifest.version);
const modules = { ...baseModules, ...tierModules };
const chosen = new Set<string>();
const images: Record<string, string> = {};
const prefix = '/cc-ftl/wiki/generated/sprites/';

const toSlug = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function select(id: string | undefined): void {
  if (!id) return;
  if (manifest.assets[id]?.kind === 'static') chosen.add(id);
}
for (const [id, def] of Object.entries(modules)) {
  // Tier variants that share placeholder art should not advertise a distinct
  // model. Only use their own art if it really exists in the manifest.
  const declared = def.asset;
  if (def.tierArt && declared === modules['module.engine']?.asset) continue;
  select(declared);
}
for (const def of Object.values(vehicles)) select(def.asset);
for (const def of Object.values(modules)) if (def.weapon && weapons[def.weapon as keyof typeof weapons]) select(def.asset);
// Include item art only if an actual, individual static frame exists.
for (const id of Object.keys(items)) select(id);

sharp.cache(false);
sharp.concurrency(2);
await mkdir(target, { recursive: true });
for (const name of await readdir(target)) {
  if (name.endsWith('.png')) await rm(join(target, name));
}
let rendered = 0;
for (const id of [...chosen].sort()) {
  const def = manifest.assets[id];
  if (!def || def.kind !== 'static') continue;
  const asset = def as StaticAsset;
  const sheet = manifest.sheets[asset.sheet];
  if (!sheet) throw Error('Missing sheet ' + asset.sheet + ' for asset ' + id);
  const input = resolve(assetsRoot, sheet.image);
  if (!input.startsWith(assetsRoot + sep)) throw Error('Unsafe sheet path: ' + sheet.image);
  const { x, y, w, h } = asset.frame;
  if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w <= 0 || h <= 0) throw Error('Invalid frame ' + id);
  const slug = toSlug(id);
  const output = join(target, slug + '.png');
  try {
    // Only a manifest-defined frame is used. Keep alpha, trim empty borders,
    // and preserve the pixel-art look with nearest-neighbour resampling.
    await sharp(input).extract({ left: x, top: y, width: w, height: h })
      .trim({ background: '#00000000', threshold: 5 })
      .resize(384, 240, { fit: 'contain', background: '#00000000', kernel: 'nearest' })
      .png({ compressionLevel: 9 }).toFile(output);
    images[id] = prefix + slug + '.png';
    rendered++;
  } catch (error) {
    // Some optional source frames may be missing/out of bounds in the atlas.
    // Omitting an invalid thumbnail is safer than publishing a wrong sprite
    // or preventing every gameplay reference page from building.
    console.warn('Skipping invalid sprite ' + id + ' from ' + relative(assetsRoot, input) + ': ' + String(error));
  }
}
await mkdir(join(root, 'src/data/generated'), { recursive: true });
await (await import('node:fs/promises')).writeFile(join(root, 'src/data/generated/sprites.json'), JSON.stringify(images, null, 2) + '\n');
console.log('Extracted ' + rendered + ' unique game-art thumbnails from the sprite atlas.');
