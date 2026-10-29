#!/usr/bin/env node
/**
 * Sim-only profile in Node, no browser.
 *   npm run profile:sim -- [--ticks 5000] [--seed 1] [--rows 25] [--out profile-sim.json] [--empty]
 * Prints a per-system report (self time sorted) and writes the JSON summary. `--empty` skips populating the start node.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const ticks = Number(opt('ticks', 5000));
const seed = Number(opt('seed', 1));
const rows = Number(opt('rows', 25));
const out = resolve(opt('out', 'profile-sim.json'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const mod = await server.ssrLoadModule('/tools/profile/simProfile.ts');
  const r = mod.profileSim({ ticks, seed, rows, populate: !args.includes('--empty') });
  console.log(`sim profile: seed=${seed} ticks=${ticks} entities=${r.entities}  (frame = one tick here)`);
  console.log(r.report);
  writeFileSync(out, JSON.stringify(r.summary, null, 1));
  console.error(`summary JSON written to ${out}`);
} finally {
  await server.close();
}
