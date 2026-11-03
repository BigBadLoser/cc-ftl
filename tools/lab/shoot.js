#!/usr/bin/env node
/**
 * Screenshot a render lab panel in headless Chromium.
 *   npm run lab -- --panel sprites [--query "&ids=fx.shield_&zoom=2"] [--out lab.png] [--width 1920] [--scale 2]
 *                  [--url http://host:port/] [--port N]
 * Starts `vite` on a free port unless --url is given (then it uses that dev server), opens
 * `/tools/lab/?panel=..<query>`, waits for the still to be drawn (`window.__labReady`), takes a full-page shot and stops
 * the server by PID. A still is drawn once, so even software GL needs only a few seconds per shot.
 * Several shots in one browser: --batch shots.json, a list of { panel, query, out }.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

const freePort = () => new Promise((res, rej) => {
  const s = createServer();
  s.once('error', rej);
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address();
    s.close(() => res(port));
  });
});

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const width = Number(opt('width', 1920));
const scale = Number(opt('scale', 2));
const given = opt('url', null);
const portArg = opt('port', null);
const batch = opt('batch', null);
const shots = batch
  ? JSON.parse(readFileSync(batch, 'utf8'))
  : [{ panel: opt('panel', ''), query: opt('query', ''), out: opt('out', 'lab.png') }];

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('playwright-core'));
}

let server;
const stopServer = () => {
  if (server && server.exitCode === null) server.kill('SIGTERM'); // by PID, never pkill
};
process.on('exit', stopServer);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => process.exit(130));

async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`dev server did not answer at ${url}`);
}

const port = portArg ? Number(portArg) : await freePort();
const base = (given ?? `http://127.0.0.1:${port}/`).replace(/\/?$/, '/');
if (!given) {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.error(`dev server pid ${server.pid}`);
  await waitFor(base, 60000);
}

const browser = await chromium.launch();
let failed = 0;
try {
  const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  for (const s of shots) {
    const url = `${base}tools/lab/?panel=${encodeURIComponent(s.panel ?? '')}${s.query ?? ''}`;
    const t0 = Date.now();
    await page.goto(url);
    await page.waitForFunction(() => window.__labReady === true, null, { timeout: 180000 });
    const err = await page.evaluate(() => window.__labError);
    if (err) {
      failed++;
      console.error(`${s.panel}: ${err}`);
      continue;
    }
    const out = resolve(s.out ?? `lab-${s.panel}.png`);
    await page.screenshot({ path: out, fullPage: true, timeout: 180000 });
    console.log(`${out} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
