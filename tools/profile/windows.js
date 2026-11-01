#!/usr/bin/env node
/** npm run profile:windows -- [--scenario colony] [--ticks 30000] [--window 2500] [--seed 1] [--label sim/schedule] */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const mod = await server.ssrLoadModule('/tools/profile/windows.ts');
  const rows = mod.profileWindows({ ticks: Number(opt('ticks', 30000)), seed: Number(opt('seed', 1)), window: Number(opt('window', 2500)), scenario: opt('scenario', undefined), label: opt('label', undefined), saveJson: opt('save', undefined) ? readFileSync(opt('save'), 'utf8') : undefined });
  console.log('tick   mean_ms  p95_ms  max_ms  jobs reserved crew entities  kinds');
  for (const r of rows) console.log(`${String(r.tick).padStart(6)} ${r.mean.toFixed(3).padStart(8)} ${r.p95.toFixed(3).padStart(7)} ${r.max.toFixed(2).padStart(7)} ${String(r.jobs).padStart(5)} ${String(r.reserved).padStart(7)} ${String(r.crew).padStart(4)} ${String(r.entities).padStart(8)}  ${JSON.stringify(r.byKind)}`);
} finally { await server.close(); }
