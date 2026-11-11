/**
 * Dev-server endpoint for the layout lab's feedback cases (never part of the build: `apply: 'serve'`). It lists, reads and writes
 * `tools/layout/cases/<slug>.json`; a slug is letters, digits and dashes only, so no request can leave that folder.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, 'cases');
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;

/** @returns {import('vite').Plugin} */
export function layoutCases() {
  return {
    name: 'layout-lab-cases',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__layout/cases', (req, res) => {
        const send = (code, body, type = 'application/json') => {
          res.statusCode = code;
          res.setHeader('content-type', type);
          res.end(typeof body === 'string' ? body : JSON.stringify(body));
        };
        const slug = (req.url ?? '/').replace(/^\//, '').split('?')[0] ?? '';
        if (req.method === 'GET' && slug === '') {
          const names = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort() : [];
          send(200, names);
        } else if (req.method === 'GET' && SLUG.test(slug)) {
          const file = join(DIR, `${slug}.json`);
          if (existsSync(file)) send(200, readFileSync(file, 'utf8'));
          else send(404, { error: 'no such case' });
        } else if (req.method === 'POST' && SLUG.test(slug)) {
          let text = '';
          req.setEncoding('utf8');
          req.on('data', (c) => { text += c; });
          req.on('end', () => {
            try {
              JSON.parse(text);
              mkdirSync(DIR, { recursive: true });
              writeFileSync(join(DIR, `${slug}.json`), text);
              send(200, { path: `tools/layout/cases/${slug}.json` });
            } catch (e) {
              send(400, { error: e instanceof Error ? e.message : String(e) });
            }
          });
        } else send(400, { error: 'bad request' });
      });
    },
  };
}
