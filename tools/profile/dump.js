#!/usr/bin/env node
/** npm run profile:dump -- --save save.json */
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const i = process.argv.indexOf('--save');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const mod = await server.ssrLoadModule('/tools/profile/dump.ts');
  console.log(JSON.stringify(mod.dumpSave(readFileSync(process.argv[i + 1], 'utf8')), null, 1));
} finally { await server.close(); }
