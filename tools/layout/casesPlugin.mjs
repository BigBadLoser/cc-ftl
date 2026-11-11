/**
 * Dev-server endpoint for the layout lab's feedback cases (never part of the build: `apply: 'serve'`). It lists, reads and writes
 * `tools/layout/cases/<slug>.json`; a slug is letters, digits and dashes only, so no request can leave that folder.
 */
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, 'cases');
const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
/** `<slug>.<what>.png`: the images saved beside a case. */
const IMAGE = /^([a-z0-9][a-z0-9-]{0,120})\.(original|edited|overlay|preview-original|preview-edited)\.png$/;

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
        } else if (req.method === 'POST' && IMAGE.test(slug)) {
          let text = '';
          req.setEncoding('utf8');
          req.on('data', (c) => { text += c; });
          req.on('end', () => {
            const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(text);
            if (!m) { send(400, { error: 'not a png data url' }); return; }
            mkdirSync(DIR, { recursive: true });
            writeFileSync(join(DIR, slug), Buffer.from(m[1] ?? '', 'base64'));
            send(200, { path: `tools/layout/cases/${slug}` });
          });
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
