#!/usr/bin/env node
/**
 * Large-scale galaxy shape metrics over several seeds.
 *   node tools/starmap/metrics.js [--seeds 1,2,3,4] [--radius 5]
 * Prints one JSON line per seed, then a table (seeds as columns, metrics as rows).
 */
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seeds = String(opt('seeds', '1,2,3,4')).split(',').map(Number);
const radius = Number(opt('radius', 5));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const lib = await server.ssrLoadModule('/tools/starmap/metrics.ts');
  const results = [];
  for (const seed of seeds) {
    const t0 = performance.now();
    const m = lib.metrics(seed, radius);
    results.push(m);
    console.log(JSON.stringify({ seed, radius, ms: Math.round(performance.now() - t0), ...m }));
  }
  const keys = Object.keys(results[0] ?? {});
  const w = Math.max(...keys.map((k) => k.length), 6);
  console.log(['metric'.padEnd(w), ...seeds.map((s) => String(s).padStart(9))].join(' '));
  for (const k of keys) console.log([k.padEnd(w), ...results.map((r) => String(r[k]).padStart(9))].join(' '));
} finally {
  await server.close();
}
