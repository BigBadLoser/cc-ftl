#!/usr/bin/env node
/**
 * Starmap previews at the three zoom levels (sector, sectors, regions), rendered to PNG with headless Chromium.
 *   node tools/starmap/local.js [--seed 1] [--sector s.0.0] [--out tools/starmap/out]
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
const sector = opt('sector', 's.0.0');
const out = resolve(opt('out', 'tools/starmap/out'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
const svgs = [];
try {
  const lib = await server.ssrLoadModule('/tools/starmap/sectorview.ts');
  const zoom = await server.ssrLoadModule('/tools/starmap/zoom.ts');
  const res = lib.localView(seed, sector);
  svgs.push(res.svg, zoom.regionView(seed, sector), zoom.galaxyView(seed, sector));
  console.log(JSON.stringify({ seed, ...res.stats }));
} finally {
  await server.close();
}
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  for (const [i, svg] of svgs.entries()) {
    await page.setContent(`<html><body style="margin:0;background:#05070d">${svg}</body></html>`);
    const file = join(out, `local-${seed}-${sector}-z${i + 1}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
} finally {
  await browser.close();
}
