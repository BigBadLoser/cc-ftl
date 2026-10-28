import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules as baseModules } from '../../src/content/modules.ts';
import { tierModules } from '../../src/content/tiers.ts';
import { items as sourceItems } from '../../src/content/items.ts';

// Deliberately import only pure content definitions. Do not bootstrap simulation,
// rendering, window globals, or the complete game runtime inside the wiki build.
type Material = { item: string; count: number };
type ModuleEntry = { name: string; description?: string; category?: string; footprint: [number, number]; power: number; maxHp?: number; buildWork?: number; cost?: Material[]; blueprint?: unknown };
type ItemEntry = { name: string; tags?: string[]; stackSize: number; price?: number; description?: string };
const modules = { ...baseModules, ...tierModules } as Record<string, ModuleEntry>;
const items = sourceItems as Record<string, ItemEntry>;
const root = fileURLToPath(new URL('../', import.meta.url));
const generated = join(root, 'src/data/generated');
const moduleRoutes = join(root, 'src/routes/reference/modules');
const itemRoutes = join(root, 'src/routes/reference/items');

function slugOf(id: string, prefix: string): string {
  // Most IDs use module./item., but a few legacy module IDs (e.g. container.2x4) do not.
  const slug = (id.startsWith(prefix) ? id.slice(prefix.length) : id)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  if (!/^[a-z0-9-]+$/.test(slug)) throw Error('Unsafe reference slug: ' + id);
  return slug;
}
function frontmatter(name: string): string {
  return '---\ntitle: ' + JSON.stringify(name) + '\nsidebar: false\n---\n\n';
}
function markdown(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
}
async function putGenerated(parent: string, slug: string, body: string): Promise<void> {
  const target = join(parent, slug);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, '+page.md'), body, 'utf8');
}
async function clearGenerated(parent: string): Promise<void> {
  await mkdir(parent, { recursive: true });
  for (const dir of await readdir(parent, { withFileTypes: true })) {
    if (dir.isDirectory()) await rm(join(parent, dir.name), { recursive: true });
  }
}
async function main(): Promise<void> {
  await mkdir(generated, { recursive: true });
  await clearGenerated(moduleRoutes);
  await clearGenerated(itemRoutes);
  const seen = new Set<string>();
  const moduleCatalog = [];
  for (const [id, def] of Object.entries(modules).sort(([a], [b]) => a.localeCompare(b))) {
    const slug = slugOf(id, 'module.');
    if (seen.has(slug)) throw Error('Duplicate module slug: ' + slug);
    seen.add(slug);
    const category = def.category ?? 'other';
    moduleCatalog.push({ id, slug, name: def.name, category, footprint: def.footprint, power: def.power });
    const lines = [
      frontmatter(def.name), '# ' + markdown(def.name), '',
      def.description ? markdown(def.description) : 'Ship equipment.', '',
      '## Statistics', '',
      '| Attribute | Value |', '|---|---:|',
      '| Category | ' + markdown(category) + ' |',
      '| Footprint | ' + def.footprint.join(' × ') + ' tiles |',
      '| Power | ' + (def.power > 0 ? '+' : '') + def.power + ' |',
      ...(def.maxHp !== undefined ? ['| Durability | ' + def.maxHp + ' HP |'] : []),
      ...(def.buildWork !== undefined ? ['| Construction work | ' + def.buildWork + ' |'] : []),
    ];
    if (def.cost?.length) {
      lines.push('', '## Construction materials', '', '| Material | Count |', '|---|---:|');
      for (const material of def.cost) {
        if (!(material.item in items)) throw Error('Unknown construction material ' + material.item + ' on ' + id);
        const itemSlug = slugOf(material.item, 'item.');
        lines.push('| [' + markdown(items[material.item]!.name) + '](../../items/' + itemSlug + '/) | ' + material.count + ' |');
      }
    }
    lines.push('', '[All ship modules](../)', '');
    await putGenerated(moduleRoutes, slug, lines.join('\n'));
  }

  const itemCatalog = [];
  const itemRows = [];
  seen.clear();
  for (const [id, def] of Object.entries(items).sort(([a], [b]) => a.localeCompare(b))) {
    const slug = slugOf(id, 'item.');
    if (seen.has(slug)) throw Error('Duplicate item slug: ' + slug);
    seen.add(slug);
    itemCatalog.push({ id, slug, name: def.name, tags: def.tags ?? [], stackSize: def.stackSize, price: def.price ?? null });
    itemRows.push('- [' + markdown(def.name) + '](./' + slug + '/) — ' + (def.tags ?? []).join(', '));
    const lines = [
      frontmatter(def.name), '# ' + markdown(def.name), '',
      def.description ? markdown(def.description) : '',
      '| Attribute | Value |', '|---|---:|',
      '| Stack limit | ' + def.stackSize + ' |',
      '| Tags | ' + markdown((def.tags ?? []).join(', ') || 'none') + ' |',
      '| Base value | ' + (def.price === undefined ? 'Not priced' : def.price + ' credits') + ' |',
      '', 'Base value does not guarantee a particular station price.', '',
      '[All items](../)', '',
    ];
    await putGenerated(itemRoutes, slug, lines.join('\n'));
  }
  await writeFile(join(generated, 'modules.json'), JSON.stringify(moduleCatalog, null, 2) + '\n');
  await writeFile(join(generated, 'items.json'), JSON.stringify(itemCatalog, null, 2) + '\n');
  // Rebuild the human-readable index from game data. This is a deterministic generated file.
  const itemIndex = [
    '---', 'title: Items and resources', 'order: 3', '---', '',
    '# Items and resources', '',
    'The following item entries are generated from CC-FTL definitions. Base values are not guaranteed station prices.', '',
    ...itemRows, ''
  ].join('\n');
  await writeFile(join(itemRoutes, '+page.md'), itemIndex, 'utf8');
  console.log('Generated ' + moduleCatalog.length + ' module pages and ' + itemCatalog.length + ' item pages.');
}
await main();
