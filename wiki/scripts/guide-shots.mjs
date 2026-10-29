// Screenshot recipes for the guides, run by capture-guides.mjs. Each shot:
//   name      output path under static/guides/ (no extension); guides reference /guides/<name>.webp
//   query     the game URL's query string (debug starts such as ?seed= or ?scenario=)
//   settle    ms to wait after load before the steps (default 6000)
//   steps     async (h) => { ... } using the helpers in capture-guides.mjs (click, testid, key, zoom, pan, hideUi)
//   selector  screenshot just this element; or clip: { x, y, width, height }; or the whole viewport
//   keyOut    make the flat space background transparent and trim to the ship (for HUD-less shots)
// A fixed ?seed keeps the crew names, ship and start node the same between runs.
export const shots = [
  {
    name: 'first-hour/start',
    query: '?seed=3',
  },
  {
    name: 'first-hour/ship',
    query: '?seed=3',
    steps: async (h) => { await h.hideUi(); },
    keyOut: true,
  },
];
