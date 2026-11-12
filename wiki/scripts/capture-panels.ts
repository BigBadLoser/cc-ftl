// Runs every recipe in panel-recipes.ts and saves the panel data the guides show (one file per recipe: src/data/generated/panels/<name>.json).
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { panels } from './panel-recipes.ts';

const out = fileURLToPath(new URL('../src/data/generated/panels/', import.meta.url));
const t = Date.now();
const data = Object.fromEntries(Object.entries(panels).map(([name, recipe]) => [name, recipe()]));
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [name, value] of Object.entries(data)) await writeFile(join(out, name + '.json'), JSON.stringify(value) + '\n');
console.log(`Live panels: ${Object.keys(data).length} from headless games (${Date.now() - t} ms)`);
