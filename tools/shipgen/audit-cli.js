#!/usr/bin/env node
/**
 * Room-layout audit (tools/shipgen/audit.ts): flow, rooms behind rooms, empty rooms, crew-scaled sizes, tier slack.
 *   node tools/shipgen/audit-cli.js [spec,spec|all] [--from 1] [--count 12] [--depth 4]
 * Specs as for cli.js: faction.navy, faction.drones:picket, station.trading:outpost,hub.
 */
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const which = args[0] && !args[0].startsWith('--') ? args[0] : 'all';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const lib = await server.ssrLoadModule('/tools/shipgen/auditRun.ts');
  const specs = which === 'all' ? lib.allSpecs() : which.split(';');
  console.log(lib.auditSheet(specs, Number(opt('from', 1)), Number(opt('count', 12)), Number(opt('depth', 4))));
} finally {
  await server.close();
}
