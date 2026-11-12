#!/usr/bin/env node
/**
 * Where the legacy wheel's 2x2 wall blocks come from: counts them on the raw structure (after the arranger, before
 * finishLayout) and on the finished template, classified by position (outer hull, void edge, interior; near a diagonal).
 *   node tools/shipgen/slabSources.js
 */
import { createServer } from 'vite';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const L = (p) => server.ssrLoadModule(p);
  const [{ content }, sg, { arrangeHull }, { planStation }, { Rng }, gen] = await Promise.all([
    L('/src/content/index.ts'), L('/src/sim/shipgen/stationGen.ts'), L('/src/sim/shipgen/navyLayouts.ts'), L('/src/sim/shipgen/stationPlan.ts'), L('/src/sim/rng.ts'), L('/src/sim/shipgen/generate.ts')]);
  const blocks = (rows) => { const out = []; for (let y = 0; y + 1 < rows.length; y++) for (let x = 0; x + 1 < rows[y].length; x++) if (rows[y][x] === '#' && rows[y][x + 1] === '#' && rows[y + 1][x] === '#' && rows[y + 1][x + 1] === '#') out.push([x, y]); return out; };
  const classify = (rows, list) => {
    const at = (x, y) => rows[y]?.[x] ?? '.';
    const W = Math.max(...rows.map((r) => r.length)), H = rows.length;
    // exterior = space connected to the border
    const ext = new Set(); const q = [];
    for (let x = 0; x < W; x++) for (const y of [0, H - 1]) if (at(x, y) === '.') { ext.add(y * W + x); q.push([x, y]); }
    for (let y = 0; y < H; y++) for (const x of [0, W - 1]) if (at(x, y) === '.' && !ext.has(y * W + x)) { ext.add(y * W + x); q.push([x, y]); }
    for (let i = 0; i < q.length; i++) { const [x, y] = q[i]; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H || at(xx, yy) !== '.' || ext.has(yy * W + xx)) continue; ext.add(yy * W + xx); q.push([xx, yy]); } }
    const c = { outerHull: 0, voidEdge: 0, interior: 0, diagonal: 0 };
    for (const [x, y] of list) {
      let outer = false, inner = false;
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) { if (at(x + dx, y + dy) !== '.') continue; if (ext.has((y + dy) * W + x + dx)) outer = true; else inner = true; }
      if (outer) c.outerHull++; else if (inner) c.voidEdge++; else c.interior++;
      const a = Math.abs((Math.atan2(y + 1 - H / 2, x + 1 - W / 2) * 180 / Math.PI + 360) % 90 - 45);
      if (a < 20) c.diagonal++;
    }
    return c;
  };
  for (const [kind, seed] of [['station.trading', 1], ['station.trading', 2], ['station.farming', 1], ['station.mining', 1]]) {
    const o = content.stations[kind];
    const def = { ...o, tiers: { ...o.tiers, station: { ...o.tiers.station, grammars: [{ value: 'stationWheel', weight: 1 }] } } };
    const f = sg.stationFaction(def, 'station');
    const fam = f.hullFamilies[0];
    // attempt 0 only, as generateStation does first
    const rng = new Rng(gen.seedOf(seed, 0));
    const plan = planStation(rng, def, 'station', { id: 'station', weight: fam.weight, archetypes: [] }, content.modules, 0);
    const r = arrangeHull(rng, f, fam, plan, content.modules, 4, false, false, false);
    if (typeof r === 'string') { console.log(kind, seed, 'arrange failed', r); continue; }
    const raw = r.b.cv.crop().rows;
    const rawBlocks = blocks(raw);
    const g = sg.generateStation(def, kind, 'station', seed, content.modules, false, 'off');
    const fin = blocks(g.template.rows);
    console.log(`${kind} s${seed}: raw structure ${rawBlocks.length} blocks ${JSON.stringify(classify(raw, rawBlocks))} -> finished ${fin.length} ${JSON.stringify(classify(g.template.rows, fin))}; thinWalls ${JSON.stringify(g.thin)}; attempts ${g.attempts}`);
  }
} finally { await server.close(); }
