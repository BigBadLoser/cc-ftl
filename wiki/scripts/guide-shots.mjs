// Screenshot recipes for the guides, run by capture-guides.mjs. Each shot:
//   name      output path under static/guides/ (no extension); guides show it with <GuideShot name="...">
//   query     the game URL's query string (debug starts such as ?seed= or ?scenario=)
//   settle    ms to wait after load before the steps (default 6000)
//   steps     async (h) => { ... } using the helpers in capture-guides.mjs (click, testid, key, zoom, pan, hideUi)
//   selector  screenshot just this element (pad: px of margin around it); or clip: { x, y, width, height }; or the whole viewport
//   marks     [[label, selector, anchor?], ...]: numbered callouts <GuideShot> draws over those elements; the badge
//             sits on the box's top-left corner, or with anchor 'left' just outside the middle of its left edge
//   keyOut    make the flat space background transparent and trim to the ship (for HUD-less shots)
//   quality   lossy WebP quality (default lossless)
// ?starter=wayfarer picks the Wayfarer (it has a shuttle). A fixed ?seed keeps the crew names, ship and start node the same between runs.
export const shots = [
  // The home page hero's background: the start node's own backdrop (stars, nebula, its planet), away from the ships.
  {
    name: 'home/backdrop',
    query: '?seed=3&starter=wayfarer',
    steps: async (h) => { await h.key('Space'); await h.hideHud(); await h.page.evaluate(() => window.__cc.focus(20, 110)); await h.wait(800); },
    quality: 82,
  },
  {
    name: 'first-hour/hud',
    query: '?seed=3&starter=wayfarer',
    steps: async (h) => { await h.key('Space'); await h.wait(300); },
    marks: [
      ['1', '[data-testid="navstrip"]'],
      ['2', '[data-testid="crewbar"]'],
      ['3', '[data-testid="clock"] >> xpath=..', 'left'],
      ['4', '[data-testid="goals"]', 'left'],
      ['5', '[data-testid="toolbar"]'],
    ],
  },
  // Also the home page's hero image.
  {
    name: 'first-hour/ship',
    query: '?seed=3&starter=wayfarer',
    steps: async (h) => {
      // Frame the player's ship alone (the helm's ship), so the neighbouring station stays out of the cut-out and the ship is centred.
      await h.page.evaluate(() => { const id = window.__cc.modules('module.helm')[0]?.shipId; if (id !== undefined) window.__cc.frame([id]); });
      await h.wait(1500);
      await h.hideUi();
    },
    keyOut: true,
  },
  {
    name: 'first-hour/starmap',
    query: '?seed=3&starter=wayfarer',
    steps: async (h) => {
      await h.key('Space');
      await h.key('m');
      await h.page.getByTestId('starmap').waitFor();
      await h.page.mouse.move(960, 700); // off the buttons: no tooltip over the map
      await h.wait(4000); // the galaxy geometry builds a piece at a time (bridge.warmStarmap); give it time to finish drawing
    },
  },
];
