// Capture the built wiki in a real headless browser, including sidebar state.
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const output = resolve('wiki-preview');
const base = 'http://127.0.0.1:8765/cc-ftl/wiki/';
const executablePath = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => {
  if (response.status() >= 400 && response.url().startsWith(base)) errors.push(response.status() + ' ' + response.url());
});
async function visit(path) {
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 45000 });
  await page.locator('body').waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 4) throw Error(path + ' has horizontal overflow of ' + overflow + 'px');
}
async function shot(name, fullPage = false) {
  await page.screenshot({ path: resolve(output, name + '.png'), fullPage, animations: 'disabled' });
  console.log('Captured ' + name + '.png');
}
try {
  await visit('reference/modules/fabricator/');
  const cards = page.locator('.wiki-recipe-card');
  if (await cards.count() < 1) throw Error('Fabricator has no recipe cards');
  if (await cards.locator('a[href*="/reference/items/"]').count() < 2) throw Error('Recipe materials are missing item links');
  const expanded = await page.locator('.content').first().boundingBox();
  await shot('fabricator-open', true);
  const toggle = page.locator('.wiki-sidebar-toggle');
  await toggle.click();
  await page.waitForFunction(() => document.documentElement.classList.contains('wiki-sidebar-hidden'));
  const collapsed = await page.locator('.content').first().boundingBox();
  if (collapsed && expanded && collapsed.width <= expanded.width + 10) throw Error('Sidebar collapse failed to expand content');
  await shot('fabricator-collapsed', true);
  await toggle.click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('wiki-sidebar-hidden'));
  await visit('reference/modules/refinery/');
  if (await page.locator('.wiki-recipe-card').count() < 1) throw Error('Refinery has no recipe cards');
  await shot('refinery-detail', true);
  await visit('reference/recipes/');
  if (await page.locator('.wiki-recipe-card').count() !== 12) throw Error('Expected 12 catalog recipe cards');
  await shot('recipes-catalog');
  for (const [path, name] of [
    ['reference/modules/', 'modules-catalog'],
    ['reference/weapons/', 'weapons-catalog'],
    ['reference/vehicles/', 'vehicles-catalog'],
    ['reference/research/', 'research-catalog'],
    ['reference/modules/airlock/', 'airlock-detail']
  ]) {
    await visit(path);
    await shot(name, name === 'airlock-detail');
  }
  await page.setViewportSize({ width: 960, height: 980 });
  await visit('reference/modules/');
  await shot('modules-narrow');
  if (errors.length) throw Error('Browser errors:\n' + errors.join('\n'));
} finally {
  await browser.close();
}
