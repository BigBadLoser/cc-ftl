#!/usr/bin/env node
/**
 * Profile the running game in headless Chromium and print the report.
 *   npm run profile -- [--scenario log|hullplan|handover|bounty|survey|none] [--seconds 20] [--speed 1|2|3] [--seed 1]
 *                      [--out profile.json] [--warmup 2] [--port N (default: a free one)] [--url http://host:port/] [--rows 20]
 * Starts `vite` (dev server: system labels need unminified function names) unless --url is given, opens
 * `/?scenario=..&perf&seed=..`, lets it run, prints `__perf.report()` and writes `__perf.summary()` JSON to --out.
 * Every scenario name is passed straight through as `?scenario=`. No scenario (or `none`) = colony baseline.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';

/** A free port: the OS picks one, so we never talk to somebody else's dev server by mistake. */
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
const scenario = opt('scenario', 'none');
const seconds = Number(opt('seconds', 20));
const speed = opt('speed', null);
const seed = opt('seed', '1');
const out = resolve(opt('out', 'profile.json'));
const warmup = Number(opt('warmup', 2));
const portArg = opt('port', null);
const rows = Number(opt('rows', 20));
const given = opt('url', null);
const ALIAS = { none: '', baseline: '' };
const scenarioParam = scenario in ALIAS ? ALIAS[scenario] : scenario;

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
const base = given ?? `http://127.0.0.1:${port}/`;
if (!given) {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
  console.error(`dev server pid ${server.pid}`);
  await waitFor(base, 60000);
  await new Promise((r) => setTimeout(r, 3000)); // let vite finish its dependency scan before the first page load
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => console.error('pageerror:', e.message));
  const q = new URLSearchParams();
  if (scenarioParam) q.set('scenario', scenarioParam);
  q.set('perf', '');
  q.set('seed', seed);
  await page.goto(`${base}?${q.toString().replace('perf=', 'perf')}`);
  await page.waitForFunction(() => window.__perf && window.__perf.summary().frames > 5, null, { timeout: 60000, polling: 500 });
  if (speed) await page.keyboard.press(speed);
  await page.waitForTimeout(warmup * 1000);
  await page.evaluate(() => { window.__perf.reset(); window.__perf.startRecording(); });
  await page.waitForTimeout(seconds * 1000);
  const result = await page.evaluate((n) => {
    window.__perf.stopRecording();
    return { report: window.__perf.report(n), summary: window.__perf.summary(30) };
  }, rows);
  console.log(`scenario=${scenario} seed=${seed} seconds=${seconds} speed=${speed ?? 'default'}`);
  console.log(result.report);
  writeFileSync(out, JSON.stringify(result.summary, null, 1));
  console.error(`summary JSON written to ${out}`);
} finally {
  await browser.close();
  stopServer();
}
