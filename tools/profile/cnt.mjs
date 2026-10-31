import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({ root: '/home/user/cc-ftl-perf', server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const mod = await server.ssrLoadModule('/tools/profile/windows.ts');
mod.profileWindows({ ticks: 300, window: 300, seed: 1, saveJson: readFileSync(process.argv[2], 'utf8') });
console.log(JSON.stringify(mod.pc(), null, 1));
await server.close();
