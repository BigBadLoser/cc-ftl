import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const server = await createServer({ root: '/home/user/cc-ftl-perf', server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const mod = await server.ssrLoadModule('/tools/profile/dump2.ts');
console.log(JSON.stringify(mod.dump2(readFileSync(process.argv[2], 'utf8'))));
await server.close();
