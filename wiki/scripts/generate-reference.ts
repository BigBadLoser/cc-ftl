import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { modules as baseModules } from '../../src/content/modules.ts';
import { tierModules } from '../../src/content/tiers.ts';
import { items as sourceItems } from '../../src/content/items.ts';
import { weapons as sourceWeapons } from '../../src/content/weapons.ts';
import { vehicles as sourceVehicles } from '../../src/content/vehicles.ts';
import { recipes as sourceRecipes } from '../../src/content/recipes.ts';
import { factions as sourceFactions } from '../../src/content/factions/index.ts';
import { research as sourceResearch } from '../../src/content/research.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const generated = join(root, 'src/data/generated');
const routes = join(root, 'src/routes/reference');
const sprites = JSON.parse(await readFile(join(generated, 'sprites.json'), 'utf8')) as Record<string, string>;

// Data only: never import the runtime simulation, renderer or UI.
type Material = { item: string; count: number };
type Module = { name: string; description?: string; asset?: string; tierArt?: unknown; category?: string; footprint: [number, number]; power: number; maxHp?: number; buildWork?: number; cost?: Material[]; weapon?: string };
type Item = { name: string; description?: string; tags?: string[]; stackSize: number; price?: number };
type WeaponEffect = { type: string; amount?: number; layers?: number; seconds?: number; radius?: number; ifNoDrain?: boolean };
type Weapon = { name: string; shots: number; shotDelaySec: number; chargeSec: number; speed: number; spread: number; ammo?: string; shield: { damage: number; pierce: number; bypass?: boolean }; effects: WeaponEffect[] };
type Vehicle = { name: string; asset?: string; class: string; speed: number; maxHp: number; capacity: number; evasion: number; cargo: number; mining?: { unitsPerSec: number } };
type Recipe = { name: string; category?: string; station: string; inputs: Material[]; outputs: Material[]; work: number };
type Faction = { name: string; art?: { signature?: string[] } };
type Research = { name: string; category?: string; cost: Material[]; work: number; requires?: string[]; unlocks?: string[] };

const modules = { ...baseModules, ...tierModules } as Record<string, Module>;
const items = sourceItems as Record<string, Item>;
const weapons = sourceWeapons as Record<string, Weapon>;
const vehicles = sourceVehicles as Record<string, Vehicle>;
const recipes = sourceRecipes as Record<string, Recipe>;
const factions = sourceFactions as Record<string, Faction>;
const research = sourceResearch as Record<string, Research>;

type Kind = 'modules' | 'items' | 'weapons' | 'vehicles' | 'recipes' | 'factions' | 'research';
const registries: Record<Kind, Record<string, { name: string }>> = { modules, items, weapons, vehicles, recipes, factions, research };
const prefixes: Record<Kind, string> = { modules: 'module.', items: 'item.', weapons: 'weapon.', vehicles: 'vehicle.', recipes: 'recipe.', factions: 'faction.', research: 'research.' };
const seenSlugs: Record<Kind, Set<string>> = { modules: new Set(), items: new Set(), weapons: new Set(), vehicles: new Set(), recipes: new Set(), factions: new Set(), research: new Set() };

function slugOf(id: string, prefix: string): string {
  const slug = (id.startsWith(prefix) ? id.slice(prefix.length) : id)
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!/^[a-z0-9-]+$/.test(slug)) throw Error('Invalid content slug for ' + id);
  return slug;
}
function slug(kind: Kind, id: string): string {
  return slugOf(id, prefixes[kind]);
}
function text(value: unknown): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\r', ' ').replaceAll('\n', ' ');
}
function html(value: unknown): string {
  return String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
function page(title: string, lines: string[]): string {
  return ['---', 'title: ' + JSON.stringify(title), 'sidebar: false', '---', '', ...lines, ''].join('\n');
}
function image(url: string | undefined, name: string): string {
  if (!url) return '';
  return '<img class="wiki-sprite" src="' + html(url) + '" alt="' + html(name) + ' game sprite" loading="lazy" width="384" height="240" />';
}
function assetForModule(id: string): string | undefined {
  const def = modules[id];
  if (!def || def.tierArt) return undefined;
  return def.asset ? sprites[def.asset] : undefined;
}
function assetForWeapon(id: string): string | undefined {
  const associated = Object.entries(modules).find(([, def]) => def.weapon === id && def.asset);
  return associated ? assetForModule(associated[0]) : undefined;
}
function named(kind: Kind, id: string): string {
  const def = registries[kind][id];
  if (!def) throw Error('Broken ' + kind + ' reference: ' + id);
  return def.name;
}
function link(kind: Kind, id: string, from: Kind): string {
  return '[' + text(named(kind, id)) + '](../../' + kind + '/' + slug(kind, id) + '/)';
}
function bulletsOfMaterials(list: Material[], from: Kind): string[] {
  return list.map(material => '- ' + material.count + ' × ' + link('items', material.item, from));
}
function stats(rows: Array<[string, string | number]>): string[] {
  return ['| Attribute | Value |', '|---|---:|', ...rows.map(([a, b]) => '| ' + text(a) + ' | ' + text(b) + ' |')];
}
async function clear(kind: Kind): Promise<void> {
  const dir = join(routes, kind);
  await mkdir(dir, { recursive: true });
  for (const d of await readdir(dir, { withFileTypes: true })) {
    if (d.isDirectory()) await rm(join(dir, d.name), { recursive: true });
  }
}
async function writeEntry(kind: Kind, id: string, lines: string[]): Promise<void> {
  const path = slug(kind, id);
  if (seenSlugs[kind].has(path)) throw Error('Duplicate ' + kind + ' slug: ' + path);
  seenSlugs[kind].add(path);
  const dir = join(routes, kind, path);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, '+page.md'), page(named(kind, id), [...lines, '', '[Back to ' + kind + '](../)']), 'utf8');
}
async function writeIndex(kind: Kind, title: string, intro: string, rows: string[]): Promise<void> {
  const content = ['---', 'title: ' + JSON.stringify(title), '---', '', intro, '', ...rows, ''].join('\n');
  await writeFile(join(routes, kind, '+page.md'), content, 'utf8');
}
async function saveJson(name: string, data: unknown): Promise<void> {
  await writeFile(join(generated, name + '.json'), JSON.stringify(data, null, 2) + '\n');
}
function listIndex(kind: Kind): string[] {
  return Object.entries(registries[kind]).sort((a,b) => a[1].name.localeCompare(b[1].name))
    .map(([id, value]) => '- [' + text(value.name) + '](./' + slug(kind, id) + '/)');
}

await mkdir(generated, { recursive: true });
for (const kind of Object.keys(registries) as Kind[]) await clear(kind);

// Modules: game definition is authoritative; do not invent stats for tier art.
const moduleCatalog = [];
for (const [id, def] of Object.entries(modules).sort()) {
  const img = assetForModule(id);
  moduleCatalog.push({ id, slug: slug('modules', id), name: def.name, category: def.category ?? 'other', footprint: def.footprint, power: def.power, image: img ?? null });
  const lines = [
    image(img, def.name), def.description ? text(def.description) : 'Ship equipment.', '',
    '## Statistics', '', ...stats([
      ['Category', def.category ?? 'other'],
      ['Footprint', def.footprint.join(' × ') + ' tiles'],
      ['Power', (def.power > 0 ? '+' : '') + def.power],
      ...(def.maxHp !== undefined ? [['Durability', def.maxHp + ' HP'] as [string,string]] : []),
      ...(def.buildWork !== undefined ? [['Construction work', def.buildWork + ' ticks'] as [string,string]] : []),
    ]),
  ].filter(v => v !== '');
  if (def.cost?.length) lines.push('', '## Construction materials', '', ...bulletsOfMaterials(def.cost, 'modules'));
  if (def.weapon) lines.push('', '## Weapon', '', link('weapons', def.weapon, 'modules'));
  await writeEntry('modules', id, lines);
}
await saveJson('modules', moduleCatalog);

// Items are not assigned imaginary artwork. Only use actual item static sprites.
const itemCatalog = [];
for (const [id, def] of Object.entries(items).sort()) {
  const img = sprites[id];
  itemCatalog.push({ id, slug: slug('items', id), name: def.name, tags: def.tags ?? [], stackSize: def.stackSize, price: def.price ?? null, image: img ?? null });
  await writeEntry('items', id, [
    image(img, def.name),
    def.description ? text(def.description) : '',
    ...stats([
      ['Stack limit', def.stackSize], ['Tags', (def.tags ?? []).join(', ') || 'none'],
      ['Base value', def.price === undefined ? 'Not priced' : def.price + ' credits'],
    ]),
    '', 'Base values are not guaranteed market prices.',
  ].filter(Boolean));
}
await saveJson('items', itemCatalog);
await writeIndex('items', 'Items and resources', 'Item limits, tags, and base values. Prices at individual stations may differ.', listIndex('items'));

// Ship-mounted weapons, not crew hand weapons (those are defined as items).
for (const [id, def] of Object.entries(weapons).sort()) {
  const effectRows = def.effects.map(effect => {
    const detail = [effect.amount !== undefined ? String(effect.amount) : '', effect.layers !== undefined ? effect.layers + ' layers' : '', effect.seconds !== undefined ? effect.seconds + ' seconds' : '', effect.radius !== undefined ? 'radius ' + effect.radius : ''].filter(Boolean).join(', ');
    return '| ' + text(effect.type.replace(/([a-z])([A-Z])/g, '$1 $2')) + ' | ' + text(detail || '—') + ' |';
  });
  const img = assetForWeapon(id);
  await writeEntry('weapons', id, [
    image(img, def.name),
    'Ship-mounted weapon. Charge time assumes gunnery skill 0; power draw belongs to the installed weapon module.', '',
    ...stats([
      ['Shots per volley', def.shots], ['Delay between shots', def.shotDelaySec + ' s'],
      ['Charge time', def.chargeSec + ' s'], ['Projectile speed', def.speed + ' tiles/s'],
      ['Spread (σ)', def.spread + ' tiles'], ['Shield damage', def.shield.damage],
      ['Shield pierce', def.shield.pierce], ['Shield bypass', def.shield.bypass ? 'Yes' : 'No'],
    ]), '',
    ...(def.ammo ? ['**Ammunition:** ' + link('items', def.ammo, 'weapons'), ''] : []),
    '## On-hit effects', '', '| Effect | Value |', '|---|---|', ...effectRows,
  ]);
}
await writeIndex('weapons', 'Ship weapons', 'Weapon statistics are base values. Power draw and construction costs belong to the corresponding ship modules.', listIndex('weapons'));

// Vehicles.
for (const [id, def] of Object.entries(vehicles).sort()) {
  await writeEntry('vehicles', id, [
    image(def.asset ? sprites[def.asset] : undefined, def.name),
    ...stats([
      ['Class', def.class], ['Speed at piloting 0', def.speed + ' tiles/s'],
      ['Durability', def.maxHp + ' HP'], ['Passenger capacity', def.capacity],
      ['Cargo capacity', def.cargo], ['Evasion', def.evasion],
      ...(def.mining ? [['Mining rate', def.mining.unitsPerSec + ' units/s'] as [string,string]] : []),
    ]),
  ]);
}
await writeIndex('vehicles', 'Vehicles', 'Shuttles and other craft. Speed values describe the base vehicle before crew skill modifiers.', listIndex('vehicles'));

// Production recipes.
for (const [id, def] of Object.entries(recipes).sort()) {
  await writeEntry('recipes', id, [
    '**Production station:** ' + link('modules', def.station, 'recipes'), '',
    '**Inputs**', '', ...bulletsOfMaterials(def.inputs, 'recipes'), '',
    '**Outputs**', '', ...bulletsOfMaterials(def.outputs, 'recipes'), '',
    ...stats([['Work', def.work + ' ticks'], ['Base work duration', (def.work / 20).toFixed(1) + ' s at 20 ticks/s']]),
    '', 'Actual completion time depends on the worker and station.',
  ]);
}
await writeIndex('recipes', 'Production recipes', 'Inputs, outputs, production stations, and work requirements.', listIndex('recipes'));

// Factions: expose names and signature gear, not procedural weights,
// ship-generation configurations, or encounter probabilities.
for (const [id, def] of Object.entries(factions).sort()) {
  const signature = def.art?.signature ?? [];
  await writeEntry('factions', id, [
    'Known faction in the galaxy.', '',
    '## Characteristic equipment', '',
    ...(signature.length ? signature.map(module => '- ' + link('modules', module, 'factions')) : ['No signature equipment is listed.']),
  ]);
}
await writeIndex('factions', 'Factions', 'Known factions and their characteristic equipment. Internal ship-generation rules are intentionally excluded.', listIndex('factions'));

// Research projects.
for (const [id, def] of Object.entries(research).sort()) {
  await writeEntry('research', id, [
    ...stats([['Category', def.category ?? 'general'], ['Research work', def.work + ' ticks']]), '',
    '## Required materials', '', ...bulletsOfMaterials(def.cost, 'research'), '',
    '## Prerequisites', '', ...(def.requires?.length ? def.requires.map(m => '- ' + link('modules', m, 'research')) : ['None']), '',
    '## Unlocks', '', ...(def.unlocks?.length ? def.unlocks.map(m => '- ' + link('modules', m, 'research')) : ['None']),
  ]);
}
await writeIndex('research', 'Research', 'Project costs, prerequisites, and equipment unlocks.', listIndex('research'));

console.log('Generated reference pages: ' + Object.entries(seenSlugs).map(([kind, entries]) => kind + '=' + entries.size).join(', '));
