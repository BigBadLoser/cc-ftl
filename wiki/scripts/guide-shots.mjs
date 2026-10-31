// Screenshot recipes for the guides, run by capture-guides.mjs. Each shot:
//   name      output path under static/guides/ (no extension); guides show it with <GuideShot name="...">
//   query     the game URL's query string (debug starts such as ?seed= or ?scenario=)
//   settle    ms to wait after load before the steps (default 6000)
//   steps     async (h) => { ... } using the helpers in capture-guides.mjs (click, testid, key, zoom, pan, hideUi)
//   selector  screenshot just this element (pad: px of margin around it); or clip: { x, y, width, height }; or the whole viewport
//   marks     [[label, selector, anchor?], ...]: numbered callouts <GuideShot> draws over those elements; the badge
//             sits on the box's top-left corner, or with anchor 'left' just outside the middle of its left edge
//   keyOut    make the flat space background transparent and trim to the ship (for HUD-less shots)
// A fixed ?seed keeps the crew names, ship and start node the same between runs.
// The start node's trade station (the node strip tags it kind="ship", so match its name).
const station = '[data-testid^="node-"][aria-label^="Trade station"]';

/** Select the start node's trade station and open its panel on `tab`, answering the hail first. */
async function openStation(h, tab) {
  await h.click(station);
  await h.wait(500);
  await h.testid('open-station');
  await h.wait(500);
  if (await h.page.getByTestId('trade-hail').count()) {
    await h.testid('trade-hail');
    await h.page.getByTestId('trade-answered').first().waitFor({ timeout: 20000 }).catch(() => {});
  }
  if (tab !== 'trade') await h.testid('station-tab-' + tab);
  await h.wait(600);
  await h.key('Space');
}

export const shots = [
  {
    name: 'first-hour/hud',
    query: '?seed=3',
    steps: async (h) => { await h.key('Space'); await h.wait(300); },
    marks: [
      ['1', '[data-testid="navstrip"]'],
      ['2', '[data-testid="crewbar"]'],
      ['3', '[data-testid="clock"] >> xpath=..', 'left'],
      ['4', '[data-testid="goals"]', 'left'],
      ['5', '[data-testid="toolbar"]'],
    ],
  },
  {
    name: 'first-hour/menu',
    query: '?seed=3',
    steps: async (h) => { await h.key('Escape'); await h.wait(600); },
    selector: '[data-testid="esc-menu"]',
    pad: 24,
  },
  // Also the home page's hero image.
  {
    name: 'first-hour/ship',
    query: '?seed=3',
    steps: async (h) => { await h.hideUi(); },
    keyOut: true,
  },
  {
    name: 'first-hour/build',
    query: '?seed=3',
    steps: async (h) => { await h.key('Space'); await h.testid('tool-build'); await h.wait(500); await h.testid('tab-power'); await h.wait(500); },
    marks: [['1', '[data-testid="build-catalog"]']],
  },
  {
    name: 'first-hour/trade',
    query: '?seed=3',
    steps: (h) => openStation(h, 'trade'),
    selector: '[data-testid="station-panel"]',
  },
  {
    name: 'first-hour/jobs',
    query: '?seed=3',
    steps: (h) => openStation(h, 'jobs'),
    selector: '[data-testid="station-panel"]',
  },
  {
    name: 'first-hour/starmap',
    query: '?seed=3',
    steps: async (h) => { await h.key('Space'); await h.key('m'); await h.wait(1500); },
  },
];
