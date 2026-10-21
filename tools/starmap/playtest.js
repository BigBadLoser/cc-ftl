#!/usr/bin/env node
/**
 * Starmap playtest: travels through the real sim and checks the starmap after every jump.
 *   node tools/starmap/playtest.js [--seeds 1,2] [--jumps 30] [--prefetch 10]  (prefetch: idle calls between jumps)
 */
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seeds = opt('seeds', '1').split(',').map(Number);
const jumps = Number(opt('jumps', 30));
const prefetch = Number(opt('prefetch', 0));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
let failed = 0;
try {
  const lib = await server.ssrLoadModule('/tools/starmap/playtest.ts');
  for (const seed of seeds) {
    const r = lib.playtest(seed, jumps, 10, prefetch);
    console.log(JSON.stringify(r.stats));
    for (const f of r.failures.slice(0, 20)) console.log('  FAIL', f);
    if (r.failures.length > 20) console.log(`  ... ${r.failures.length - 20} more`);
    failed += r.failures.length;
  }
} finally {
  await server.close();
}
process.exitCode = failed ? 1 : 0;
