// Capture the in-game screenshots the guides use: starts the game's dev server, runs every recipe in
// guide-shots.mjs in headless Chromium and writes static/guides/<name>.webp. Re-run it after art or UI changes:
//   npm run capture            all shots
//   npm run capture -- ship    only shots whose name contains "ship"
// Chromium comes from Playwright's browser cache (PLAYWRIGHT_BROWSERS_PATH) or CHROME_BIN.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { shots } from './guide-shots.mjs';

const wiki = fileURLToPath(new URL('../', import.meta.url));
const out = join(wiki, 'static/guides');
const port = 5199;
const base = `http://127.0.0.1:${port}/cc-ftl/`;
const only = process.argv[2];

async function waitForServer(url, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error('Game dev server did not start at ' + url);
}

/** Helpers a recipe gets: the page, plus the moves most shots need. */
function helpers(page) {
  return {
    page,
    wait: (ms) => page.waitForTimeout(ms),
    key: (key) => page.keyboard.press(key),
    click: (selector) => page.locator(selector).first().click(),
    testid: (id) => page.getByTestId(id).click(),
    /** Wheel zoom at a screen point; positive steps zoom out. */
    async zoom(steps, x = 800, y = 500) {
      await page.mouse.move(x, y);
      for (let i = 0; i < Math.abs(steps); i++) { await page.mouse.wheel(0, Math.sign(steps) * 300); await page.waitForTimeout(120); }
    },
    /** Middle-drag the camera so screen point (x, y) moves to (toX, toY). */
    async pan(x, y, toX = 800, toY = 500) {
      await page.mouse.move(x, y);
      await page.mouse.down({ button: 'middle' });
      for (let i = 1; i <= 10; i++) await page.mouse.move(x + (toX - x) * i / 10, y + (toY - y) * i / 10);
      await page.mouse.up({ button: 'middle' });
    },
    /** Hide the HUD so only the game canvas shows. */
    async hideUi() {
      await page.evaluate(() => {
        const canvases = [...document.querySelectorAll('canvas')];
        canvases.sort((a, b) => b.width * b.height - a.width * a.height);
        canvases[0]?.classList.add('capture-main');
      });
      await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas.capture-main { visibility: visible !important; }' });
      await page.waitForTimeout(300);
    },
  };
}

/** Make the game's flat background transparent, flood-filling from the edges, then trim to the content. */
async function keyOutBackground(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const at = (x, y) => (y * w + x) * 4;
  const bg = [data[0], data[1], data[2]];
  const isBg = (i) => Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) <= 6;
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, 0, x, h - 1);
  for (let y = 0; y < h; y++) stack.push(0, y, w - 1, y);
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) continue;
    seen[y * w + x] = 1;
    const i = at(x, y);
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer();
}

// Its own process group, so stopping it also stops the vite process npx starts.
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: join(wiki, '..'), stdio: 'ignore', detached: true });
try {
  await waitForServer(base);
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
  });
  for (const shot of shots.filter((s) => !only || s.name.includes(only))) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(base + (shot.query ?? ''), { waitUntil: 'load' });
    await page.waitForTimeout(shot.settle ?? 6000);
    const h = helpers(page);
    await shot.steps?.(h);
    let png = shot.selector
      ? await page.locator(shot.selector).first().screenshot()
      : await page.screenshot({ clip: shot.clip });
    if (shot.keyOut) png = await keyOutBackground(png);
    const file = join(out, shot.name + '.webp');
    await mkdir(dirname(file), { recursive: true });
    await sharp(png).webp({ lossless: true }).toFile(file);
    console.log('Captured ' + shot.name + '.webp');
    await page.close();
  }
  await browser.close();
} finally {
  process.kill(-server.pid);
}
