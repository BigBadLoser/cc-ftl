#!/usr/bin/env node
/**
 * GIFs of a pod and a shuttle leaving and entering their bays through the floor doors (`?panel=bay-exit`, tools/lab/bayExitLab.ts).
 *   node tools/lab/bayExitGif.js <out-dir> [--fps 20] [--secs 5] [--scale 2] [--only pod-launch,...]
 * Starts vite on a free port, drives the lab page frame by frame (the page fakes the animation clock, so every frame is exact),
 * screenshots the canvas at deviceScaleFactor 2 and has ffmpeg make a palette-pass GIF per case (pod-launch, pod-land, shuttle-launch, shuttle-land).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const outDir = resolve(args[0] ?? '.');
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const fps = Number(opt('fps', 20));
const secs = Number(opt('secs', 5));
const scale = Number(opt('scale', 2));
const only = opt('only', '')?.split(',').filter(Boolean);
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }

const port = await new Promise((res) => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { stdio: 'ignore' });
process.on('exit', () => { if (server.exitCode === null) server.kill('SIGTERM'); });
const base = `http://127.0.0.1:${port}/`;
for (let i = 0; i < 240; i++) { try { if ((await fetch(base)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 250)); }

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 940, height: 560 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  for (const kind of ['pod', 'shuttle']) {
    for (const mode of ['launch', 'land']) {
      const name = `${kind}-${mode}`;
      if (only.length && !only.includes(name)) continue;
      await page.goto(`${base}tools/lab/?panel=bay-exit`);
      await page.waitForFunction(() => window.__labReady === true, null, { timeout: 120000 });
      const err = await page.evaluate(() => window.__labError);
      if (err) throw new Error(err);
      const frames = resolve(outDir, `frames-${name}`);
      rmSync(frames, { recursive: true, force: true });
      mkdirSync(frames, { recursive: true });
      const box = page.locator('canvas.bx-live');
      const n = Math.round(secs * fps);
      for (let i = 0; i < n; i++) {
        await page.evaluate(([k, m, t]) => window.__bx.frame(k, m, t), [kind, mode, i / fps]);
        await box.screenshot({ path: `${frames}/f${String(i).padStart(4, '0')}.png` });
      }
      const gif = resolve(outDir, `${name}.gif`);
      const pal = `${frames}/pal.png`;
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${frames}/f%04d.png`, '-vf', 'palettegen=stats_mode=diff', pal]);
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', `${frames}/f%04d.png`, '-i', pal, '-lavfi', 'paletteuse=dither=none', '-loop', '0', gif]);
      console.log(gif);
    }
  }
} finally {
  await browser.close();
}
process.exit(0);
