#!/usr/bin/env node
/**
 * Contact sheet of galaxy overviews for several seeds, rendered to one PNG with headless Chromium.
 *   node tools/starmap/sheet.js [--seeds 1,2,3,4] [--radius 5] [--scale 0.07] [--out tools/starmap/out]
 * Writes <out>/sheet-r<radius>.png (and the per-seed SVGs) and prints each seed's stats.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const seeds = opt('seeds', '1,2,3,4').split(',').map(Number);
const radius = Number(opt('radius', 5));
const scale = Number(opt('scale', 0.07));
const out = resolve(opt('out', 'tools/starmap/out'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const cells = [];
try {
  const lib = await server.ssrLoadModule('/tools/starmap/draw.ts');
  mkdirSync(out, { recursive: true });
  for (const seed of seeds) {
    const { svg, stats } = lib.overview(seed, radius, scale);
    writeFileSync(join(out, `galaxy-${seed}-r${radius}.svg`), svg);
    console.log(JSON.stringify({ seed, ...stats }));
    cells.push(`<figure><figcaption>seed ${seed}</figcaption>${svg}</figure>`);
  }
} finally {
  await server.close();
}
const html = `<html><body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(2,max-content);gap:6px">
<style>figure{margin:0;position:relative}figcaption{position:absolute;left:8px;top:6px;color:#cbd5e1;font:16px sans-serif}</style>
${cells.join('\n')}</body></html>`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage();
  await page.setContent(html);
  const file = join(out, `sheet-r${radius}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
} finally {
  await browser.close();
}
