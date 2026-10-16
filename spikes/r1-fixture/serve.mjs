// Tiny CORS static server for the fixture assets: node spikes/r1-fixture/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'assets');
const types = { '.json': 'application/json', '.png': 'image/png' };
createServer(async (req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'access-control-allow-origin': '*' });
    res.end();
  }
}).listen(Number(process.argv[2] ?? 4600), () => console.log('fixture on', process.argv[2] ?? 4600));
