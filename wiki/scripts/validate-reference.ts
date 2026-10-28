import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const kinds = ['modules', 'items', 'weapons', 'vehicles', 'recipes', 'factions', 'research'] as const;
type Kind = typeof kinds[number];
type CatalogEntry = { id: string; slug: string; name: string; image: string | null };
const data = JSON.parse(await readFile(join(root, 'src/data/generated/reference-catalog.json'), 'utf8')) as Record<Kind, CatalogEntry[]>;
const staticRoot = join(root, 'static');
let links = 0, images = 0, pages = 0;

async function exists(file: string): Promise<boolean> {
  try { return (await stat(file)).isFile(); } catch { return false; }
}
function inside(path: string, parent: string): boolean {
  return path.startsWith(parent + sep);
}
for (const kind of kinds) {
  const registry = data[kind];
  if (!Array.isArray(registry) || !registry.length) throw Error('Empty reference catalog: ' + kind);
  const slugs = new Set<string>();
  for (const entry of registry) {
    if (!entry.name || !entry.id || !/^[a-z0-9-]+$/.test(entry.slug)) throw Error('Malformed ' + kind + ' entry: ' + JSON.stringify(entry));
    if (slugs.has(entry.slug)) throw Error('Duplicate ' + kind + ' slug: ' + entry.slug);
    slugs.add(entry.slug);
    const path = join(root, 'src/routes/reference', kind, entry.slug, '+page.md');
    if (!await exists(path)) throw Error('Missing generated page: ' + path);
    const md = await readFile(path, 'utf8');
    pages++;
    for (const match of md.matchAll(/\]\((\.\.\/[^\s)]+)\)/g)) {
      const dest = resolve(dirname(path), match[1]!);
      if (!inside(dest, join(root, 'src/routes/reference'))) throw Error('Broken external reference path: ' + match[1] + ' in ' + path);
      if (!await exists(join(dest, '+page.md'))) throw Error('Broken reference link: ' + match[1] + ' in ' + path);
      links++;
    }
    for (const match of md.matchAll(/<img\s[^>]*src="(\/cc-ftl\/wiki\/generated\/[^"]+)"/g)) {
      const location = resolve(staticRoot, match[1]!.slice('/cc-ftl/wiki/'.length));
      if (!inside(location, staticRoot) || !await exists(location)) throw Error('Missing reference image: ' + match[1] + ' in ' + path);
      images++;
    }
    if (entry.image) {
      const location = resolve(staticRoot, entry.image.replace(/^\/cc-ftl\/wiki\//, ''));
      if (!inside(location, staticRoot) || !await exists(location)) throw Error('Missing catalog image: ' + entry.image);
      images++;
    }
    if (kind === 'recipes') {
      const station = (entry as CatalogEntry & {station?: string}).station;
      if (!station) throw Error('Recipe has no production station: ' + entry.id);
      const stationRoute = data.modules.find(module => module.id === station);
      if (!stationRoute) throw Error('Unknown recipe station: ' + entry.id + ' -> ' + station);
      const stationPage = await readFile(join(root, 'src/routes/reference/modules', stationRoute.slug, '+page.md'), 'utf8');
      if (!stationPage.includes('<ModuleRecipes station="' + station + '" />'))
        throw Error('Production station is missing recipe cards: ' + station);
    }
  }
  // Catch routes left over from an older generator version.
  const entries = (await readdir(join(root, 'src/routes/reference', kind), { withFileTypes: true })).filter(e => e.isDirectory()).map(e => e.name);
  for (const slug of entries) if (!slugs.has(slug)) throw Error('Stale generated route: ' + kind + '/' + slug);
}
console.log('Wiki reference validation passed: ' + pages + ' pages, ' + links + ' links, ' + images + ' images.');
