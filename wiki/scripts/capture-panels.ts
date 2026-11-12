// Runs every recipe in panel-recipes.ts and saves the panel data the guides show (src/data/generated/panels.json).
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { panels } from './panel-recipes.ts';

const out = fileURLToPath(new URL('../src/data/generated/', import.meta.url));
const t = Date.now();
const data = Object.fromEntries(Object.entries(panels).map(([name, recipe]) => [name, recipe()]));
await mkdir(out, { recursive: true });
await writeFile(join(out, 'panels.json'), JSON.stringify(data, null, 2) + '\n');
console.log(`Live panels: ${Object.keys(data).length} from headless games (${Date.now() - t} ms)`);
