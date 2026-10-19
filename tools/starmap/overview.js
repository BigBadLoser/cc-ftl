#!/usr/bin/env node
/**
 * Galaxy overview for judging generation quality (no browser needed for the SVG).
 *   node tools/starmap/overview.js [--seed 1] [--radius 3] [--scale 0.25] [--out tools/starmap/out]
 * Writes <out>/galaxy-<seed>-r<radius>.svg and prints chunk, sector, node and lane counts.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seed = Number(opt('seed', 1));
const radius = Number(opt('radius', 3));
const scale = Number(opt('scale', 0.25));
const out = resolve(opt('out', 'tools/starmap/out'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const lib = await server.ssrLoadModule('/tools/starmap/draw.ts');
  const t0 = performance.now();
  const { svg, stats } = lib.overview(seed, radius, scale);
  mkdirSync(out, { recursive: true });
  const file = join(out, `galaxy-${seed}-r${radius}.svg`);
  writeFileSync(file, svg);
  console.log(JSON.stringify({ file, ms: Math.round(performance.now() - t0), ...stats }));
} finally {
  await server.close();
}
