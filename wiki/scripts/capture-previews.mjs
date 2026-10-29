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
  if (await cards.locator('.recipe-material img').count() < 2) throw Error('Recipe item sprite icons are missing');
  if (await cards.locator('a[title="Shuttle"] img').count() !== 1) throw Error('Crafted shuttle must reuse its actual vehicle sprite');
  // The connector is one continuous, center-aligned geometric row. Validate
  // real rendered coordinates, not the presence of unrelated CSS decorations.
  async function verifyRecipeConnectors() {
    const geometries = await page.locator('.recipe-flow').evaluateAll(flows =>
      flows.map(flow => {
        const input = flow.querySelector('.recipe-first-input .recipe-material');
        const lead = flow.querySelector('.recipe-shaft');
        const arrow = flow.querySelector('.recipe-arrow');
        const output = flow.querySelector('.recipe-first-output .recipe-material');
        if (!input || !lead || !arrow || !output) return null;
        const a = input.getBoundingClientRect();
        const l = lead.getBoundingClientRect();
        const s = arrow.getBoundingClientRect();
        const b = output.getBoundingClientRect();
        return {
          yMaterial: a.top + a.height / 2,
          yLead: l.top + l.height / 2,
          yArrow: s.top + s.height / 2,
          yOutput: b.top + b.height / 2,
          gapFromMaterial: l.left - a.right,
          joinGap: s.left - l.right,
          noTextOverlap: l.left >= a.right,
          noOutputOverlap: s.right <= b.left + 1,
          lineWidth: l.width,
        };
      })
    );
    if (!geometries.length || geometries.some(g => !g ||
      !g.noTextOverlap || !g.noOutputOverlap ||
      Math.abs(g.yLead - g.yArrow) > 2 ||
      Math.abs(g.yMaterial - g.yArrow) > 2 ||
      Math.abs(g.yOutput - g.yArrow) > 2 ||
      Math.abs(g.joinGap) > 1 ||
      g.gapFromMaterial < 0 || g.gapFromMaterial > 12
    )) throw Error('Recipe connector geometry misaligned: ' + JSON.stringify(geometries));
  }
  await verifyRecipeConnectors();
  const expanded = await page.locator('.content').first().boundingBox();
  await shot('fabricator-open', true);
  const toggle = page.locator('.wiki-sidebar-toggle');
  await toggle.click();
  await page.waitForFunction(() => document.documentElement.classList.contains('wiki-sidebar-hidden'));
  const collapsed = await page.locator('.content').first().boundingBox();
  console.log('Content bounds: expanded=' + JSON.stringify(expanded) + ', collapsed=' + JSON.stringify(collapsed));
  if (collapsed && expanded && (collapsed.width <= expanded.width + 100 || collapsed.x >= expanded.x - 60))
    throw Error('Sidebar collapse failed to substantially expand and reposition content');
  await verifyRecipeConnectors();
  await shot('fabricator-collapsed', true);
  await toggle.click();
  await page.waitForFunction(() => !document.documentElement.classList.contains('wiki-sidebar-hidden'));
  await visit('reference/modules/refinery/');
  if (await page.locator('.wiki-recipe-card').count() < 1) throw Error('Refinery has no recipe cards');
  await shot('refinery-detail', true);
  await visit('reference/recipes/');
  if (await page.locator('.wiki-recipe-card').count() !== 12) throw Error('Expected 12 catalog recipe cards');
  await verifyRecipeConnectors();
  await shot('recipes-catalog');
  await page.setViewportSize({ width: 960, height: 980 });
  await visit('reference/recipes/');
  await verifyRecipeConnectors();
  await shot('recipes-narrow');
  await page.setViewportSize({ width: 1440, height: 1050 });
  await visit('reference/items/');
  if (await page.locator('.wiki-reference-item-card img').count() < 2) throw Error('Item catalog has no game icons');
  if (await page.getByText('AI core (trade good)', { exact: true }).count() !== 1)
    throw Error('Inventory AI core not distinguished from installed module');
  await shot('items-catalog');
  await visit('reference/items/ai-core/');
  if (!await page.getByText('Trade good, not a ship module.', { exact: false }).count())
    throw Error('Missing trade-good disambiguation');
  await shot('ai-core-trade-good');
  await visit('reference/modules/ai-core/');
  if (!await page.getByText('Installed ship module.', { exact: false }).count())
    throw Error('Missing installed AI core module disambiguation');
  await shot('ai-core-module');
  for (const [path, name] of [
    ['reference/modules/', 'modules-catalog'],
    ['reference/weapons/', 'weapons-catalog'],
    ['reference/vehicles/', 'vehicles-catalog'],
    ['reference/research/', 'research-catalog'],
    ['reference/modules/airlock/', 'airlock-detail']
  ]) {
    await visit(path);
    if (name === 'vehicles-catalog' && await page.locator('.wiki-reference-card img').count() !== 2)
      throw Error('Both vehicle sprites must appear in the vehicle catalog');
    await shot(name, name === 'airlock-detail');
  }
  await page.setViewportSize({ width: 960, height: 980 });
  await visit('reference/modules/');
  await shot('modules-narrow');
  if (errors.length) throw Error('Browser errors:\n' + errors.join('\n'));
} finally {
  await browser.close();
}
