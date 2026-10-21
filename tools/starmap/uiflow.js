#!/usr/bin/env node
/**
 * Dev-only starmap UI check in headless Chromium against a Vite dev server (nothing in src/ imports this):
 *   1. Region level: tap a charted sector away from yours, expect a plotted route with a Jump button, then jump along it
 *      (charging the FTL drive through the `?hook` debug hook, dismissing story popups) until you arrive.
 *   2. Frame times while panning at each zoom level (and with the map closed, as a baseline), on a phone-sized
 *      viewport with the CPU slowed 4x.
 *   node tools/starmap/uiflow.js [--seed 1] [--out tools/starmap/out]
 * Prints a JSON report and exits 1 if a check failed. Software GL makes the frame times pessimistic; compare runs.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seed = Number(opt('seed', 1));
const out = resolve(opt('out', 'tools/starmap/out'));
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
await server.listen();
const url = `http://localhost:${server.httpServer.address().port}/?seed=${seed}&hook`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', args: ['--use-gl=swiftshader', '--enable-webgl'] });
const failures = [];
const report = { seed, flow: {}, frames: {} };
const fail = (msg) => failures.push(msg);

async function open(page) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__cc);
  await page.click('[data-testid="starmap-open"]');
  await page.waitForSelector('[data-testid="starmap"]');
}

/** Answer any story popup with its last open choice, and close its result. */
async function dismissStory(page) {
  for (let i = 0; i < 6; i++) {
    const choices = await page.$$('[data-testid="story-choice"]:not([disabled])');
    if (choices.length) await choices[choices.length - 1].click();
    else if (await page.$('[data-testid="story-result"] button')) await page.click('[data-testid="story-result"] button');
    else return;
    await page.waitForTimeout(250);
  }
}

const fuel = async (page) => Number((await page.textContent('[data-testid="starmap-fuel"]')).replace(/\D+/g, ''));

try {
  // 1. Plot and jump from the Region level.
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => fail(`page error: ${e}`));
  await open(page);
  await page.click('[data-testid="starmap-level-2"]');
  await page.waitForTimeout(700);
  const patches = await page.$$eval('path.patch.known', (els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, cur: e.classList.contains('cur') };
  }));
  const cur = patches.find((p) => p.cur);
  const far = patches.filter((p) => !p.cur && p.y > 90 && p.y < 560).sort((a, b) => Math.hypot(b.x - cur.x, b.y - cur.y) - Math.hypot(a.x - cur.x, a.y - cur.y))[0];
  if (!cur || !far) fail('no charted sector to plot to');
  else {
    await page.mouse.click(far.x, far.y);
    await page.waitForTimeout(300);
    const card = (await page.textContent('[data-testid="starmap-info"]')) ?? '';
    const hops = Number(/Route: (\d+) jump/.exec(card)?.[1] ?? 0);
    report.flow.target = card.split('✕')[0].trim();
    report.flow.plannedJumps = hops;
    if (!hops) fail(`no route shown on the card: ${card}`);
    const fuel0 = await fuel(page);
    let jumps = 0;
    for (let left = hops; left > 0 && jumps < 8; left--) {
      await dismissStory(page);
      await page.evaluate(() => window.__cc.stage.chargeFtl());
      await page.waitForFunction(() => /FTL (\d+)\/\1s/.test(document.querySelector('[data-testid="starmap"] header')?.textContent ?? ''), null, { timeout: 15000 });
      await page.waitForTimeout(200);
      await dismissStory(page);
      const btn = await page.$('[data-testid="starmap-info-jump"]');
      if (!btn) {
        fail(`no Jump button with ${left} jumps to go`);
        break;
      }
      if (jumps === 0) await page.screenshot({ path: join(out, `uiflow-${seed}-plotted.png`) });
      await btn.click();
      jumps++;
      await page.waitForTimeout(1900);
      await dismissStory(page);
      const now = (await page.textContent('[data-testid="starmap-info"]').catch(() => '')) ?? '';
      const remaining = Number(/Route: (\d+) jump/.exec(now)?.[1] ?? 0);
      if (left > 1 && remaining !== left - 1) fail(`after jump ${jumps}: expected ${left - 1} jumps left, card says: ${now}`);
      if (left === 1 && !now.includes('You are here')) fail(`did not arrive after ${jumps} jumps: ${now}`);
    }
    report.flow.jumps = jumps;
    report.flow.fuelSpent = fuel0 - (await fuel(page));
    await page.screenshot({ path: join(out, `uiflow-${seed}-arrived.png`) });
  }
  await page.close();

  // 2. Frame times while panning, phone-sized, CPU slowed 4x.
  const phone = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2 });
  await open(phone);
  const cdp = await phone.context().newCDPSession(phone);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  // Baseline first: the ship view with the map closed (the game keeps drawing it underneath the map).
  await phone.click('[data-testid="starmap-close"]');
  for (const level of [0, 1, 2, 3]) {
    if (level === 1) await phone.click('[data-testid="starmap-open"]');
    if (level) await phone.click(`[data-testid="starmap-level-${level}"]`);
    await phone.waitForTimeout(900);
    await phone.evaluate(() => {
      window.__frames = [];
      let last = performance.now();
      const tick = (t) => {
        window.__frames.push(t - last);
        last = t;
        if (window.__frames.length < 400) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await phone.mouse.move(195, 400);
    await phone.mouse.down();
    for (let i = 0; i < 40; i++) await phone.mouse.move(195 + Math.sin(i / 6) * 120, 400 + Math.cos(i / 6) * 120, { steps: 2 });
    await phone.mouse.up();
    const f = (await phone.evaluate(() => window.__frames)).slice(2).sort((a, b) => a - b);
    const q = (p) => +f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(1);
    report.frames[level ? `level${level}` : 'mapClosed'] = { frames: f.length, p50: q(0.5), p95: q(0.95), max: q(1) };
  }
  await phone.close();
} finally {
  await browser.close();
  await server.close();
}
report.failures = failures;
console.log(JSON.stringify(report, null, 2));
process.exit(failures.length ? 1 : 0);
