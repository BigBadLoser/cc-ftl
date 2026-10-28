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
const chosen = new Map<string, { source: string; icon: boolean }>();
const images: Record<string, string> = {};
const prefix = '/cc-ftl/wiki/generated/sprites/';

const toSlug = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function select(id: string | undefined): void {
  if (!id) return;
  if (manifest.assets[id]?.kind === 'static') chosen.set(id, { source: id, icon: false });
}
/** Use the same per-item frame preference as src/app/itemIcons.ts.
 * A logical item/vehicle id maps to an actual static atlas frame. */
function selectVariant(id: string, candidates: string[], icon = false): void {
  const source = candidates.find(candidate => manifest.assets[candidate]?.kind === 'static');
  if (source) chosen.set(id, { source, icon });
}
for (const [id, def] of Object.entries(modules)) {
  // Tier variants that share placeholder art should not advertise a distinct
  // model. Only use their own art if it really exists in the manifest.
  const declared = def.asset;
  if (def.tierArt && declared === modules['module.engine']?.asset) continue;
  select(declared);
}
for (const def of Object.values(vehicles)) {
  if (!def.asset) continue;
  // Flying sprites are the actual craft, not the bay they park in.
  selectVariant(def.asset, [def.asset + '.fly.d0', def.asset + '.fly.d2', def.asset + '.parked.r0', def.asset]);
}
for (const def of Object.values(modules)) if (def.weapon && weapons[def.weapon as keyof typeof weapons]) select(def.asset);
// The game's inventory uses a medium stack, then small, then held sprite.
for (const id of Object.keys(items)) {
  selectVariant(id, [id + '.m', id + '.s', id + '.held'], true);
}

sharp.cache(false);
sharp.concurrency(2);
await mkdir(target, { recursive: true });
for (const name of await readdir(target)) {
  if (name.endsWith('.png')) await rm(join(target, name));
}
let rendered = 0;
for (const [id, selected] of [...chosen].sort(([a], [b]) => a.localeCompare(b))) {
  const def = manifest.assets[selected.source];
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
    // Force the crop to complete before trimming. Sharp may reorder a single
    // extract/trim pipeline against the uncropped sheet dimensions.
    const cropped = await sharp(input)
      .extract({ left: x, top: y, width: w, height: h })
      .png().toBuffer();
    await sharp(cropped)
      .trim({ background: '#00000000', threshold: 5 })
      .resize(selected.icon ? 72 : 384, selected.icon ? 72 : 240,
        { fit: 'contain', background: '#00000000', kernel: 'nearest' })
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
const itemCount = Object.keys(items).filter(id => images[id]).length;
const vehicleCount = Object.values(vehicles).filter(def => def.asset && images[def.asset]).length;
if (itemCount === 0) throw Error('Item icon extraction found no real inventory sprites.');
if (vehicleCount !== Object.keys(vehicles).length) throw Error('Vehicle artwork missing: ' + vehicleCount + '/' + Object.keys(vehicles).length);
console.log('Extracted ' + rendered + ' real game sprites (' + itemCount + ' item icons, ' + vehicleCount + ' vehicles).');
