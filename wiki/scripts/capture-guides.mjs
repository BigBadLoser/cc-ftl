// Capture the in-game screenshots the guides use: starts the game's dev server, runs every recipe in
// guide-shots.mjs in headless Chromium and writes static/guides/<name>.webp. Re-run it after art or UI changes:
//   npm run capture            all shots
//   npm run capture -- ship    only shots whose name contains "ship"
// Chromium comes from Playwright's browser cache (PLAYWRIGHT_BROWSERS_PATH) or CHROME_BIN.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { shots } from './guide-shots.mjs';

const wiki = fileURLToPath(new URL('../', import.meta.url));
const out = join(wiki, 'static/guides');
// Marker positions for <GuideShot>, as fractions of the image, so callouts follow the UI when it moves.
const marksOut = join(wiki, 'src/data/guide-shots');
const port = 5199;
const base = `http://127.0.0.1:${port}/cc-ftl/`;
const only = process.argv[2];
const SLOW = 120000; // generous: software GL makes some frames slow

async function waitForServer(url, exited, ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (exited() !== null) throw Error(`Game dev server exited (${exited()}) before it was ready. Is port ${port} in use? Its output:\n${serverLog.slice(-2000)}`);
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
    /** Hide the HUD and the space backdrop, so only the ships show on a flat background (for keyOut). */
    async hideUi() {
      await page.evaluate(() => window.__cc?.backdrop(false));
      await this.hideHud();
    },
    /** Hide the HUD only: the game canvas, backdrop included, is all that shows. */
    async hideHud() {
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

/** An element's box grown by `pad` px on every side, kept inside the 1920x950 viewport. */
function padded(box, pad) {
  if (!box) throw Error('Shot selector is not on screen');
  const x = Math.max(0, box.x - pad), y = Math.max(0, box.y - pad);
  return { x, y, width: Math.min(1920, box.x + box.width + pad) - x, height: Math.min(950, box.y + box.height + pad) - y };
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
// Its output is kept, and shown if it exits early (a busy port, a build error), so a failed start says why.
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: join(wiki, '..'), stdio: ['ignore', 'pipe', 'pipe'], detached: true });
let serverLog = '';
let serverExit = null;
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });
server.on('exit', (code) => { serverExit = code ?? 'signal'; });
try {
  await waitForServer(base, () => serverExit);
  let browser;
  try {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_BIN,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
    });
  } catch (err) {
    throw Error('Could not start Chromium. Install it with `npx playwright install chromium` (from wiki/), or set CHROME_BIN.\n' + String(err.message).split('\n')[0]);
  }
  for (const shot of shots.filter((s) => !only || s.name.includes(only))) {
    try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 950 } });
    await page.context().addInitScript(() => { try { localStorage.setItem('cc-ftl.lessons', JSON.stringify({ seen: [], off: true })); } catch { /* no storage */ } });
    // ?hook installs the screenshot helpers (window.__cc); lessons stay off so tutorial cards don't cover the shot.
    const query = shot.query ?? '';
    await page.goto(base + query + (query ? '&' : '?') + 'hook&lessons=off', { waitUntil: 'load' });
    await page.waitForTimeout(shot.settle ?? 6000);
    page.setDefaultTimeout(SLOW);
    const h = helpers(page);
    await shot.steps?.(h);
    const area = shot.selector ? padded(await page.locator(shot.selector).first().boundingBox(), shot.pad ?? 0) : shot.clip ?? { x: 0, y: 0, width: 1920, height: 950 };
    if (shot.marks) {
      const marks = [];
      for (const [label, selector, anchor] of shot.marks) {
        const box = await page.locator(selector).first().boundingBox();
        if (!box) throw Error(`${shot.name}: mark ${label} (${selector}) is not on screen`);
        marks.push({ label, anchor: anchor ?? 'corner', x: (box.x - area.x) / area.width, y: (box.y - area.y) / area.height, w: box.width / area.width, h: box.height / area.height });
      }
      await mkdir(marksOut, { recursive: true });
      await writeFile(join(marksOut, shot.name.replaceAll('/', '__') + '.json'), JSON.stringify(marks, null, 2) + '\n');
    }
    let png = await page.screenshot({ clip: area, timeout: 180000 });
    if (shot.keyOut) png = await keyOutBackground(png);
    const file = join(out, shot.name + '.webp');
    await mkdir(dirname(file), { recursive: true });
    // Starfields compress poorly losslessly; a shot can ask for lossy quality instead.
    await sharp(png).webp(shot.quality ? { quality: shot.quality } : { lossless: true }).toFile(file);
    console.log('Captured ' + shot.name + '.webp');
    await page.close();
    } catch (err) { console.error('FAILED ' + shot.name + ': ' + String(err.message).split('\n')[0]); process.exitCode = 1; }
  }
  await browser.close();
} catch (err) {
  console.error(String(err.message ?? err));
  process.exitCode = 1;
} finally {
  // The server may already be gone (it failed to start, or exited); that's not a second error.
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}
