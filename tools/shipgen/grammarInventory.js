#!/usr/bin/env node
/**
 * Inventory of the station grammars in the game: every grammar a station kind uses, at each size tier it is used at,
 * generated through the whole pipeline and drawn through the original views (silhouette, structure, departments).
 *   node tools/shipgen/grammarInventory.js [--seeds 1,2] [--out dir]
 * One set of sheets per size tier: a row per grammar, a column per seed, the kind that uses the grammar most.
 * Prints for each station its size, floor, rooms, built share, solid 2x2 wall blocks, the hull check and the
 * generator's own problems.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(`--${f}`); return i < 0 ? d : args[i + 1]; };
const seeds = arg('seeds', '1,2').split(',').map(Number);
const out = resolve(arg('out', 'tools/shipgen/out/inventory'));
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const L = (p) => server.ssrLoadModule(p);
  const [{ content }, sg, dep, { wallBlocks }, views, { stationHullIntegrityProblems }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }] = await Promise.all([
    '/src/content/index.ts', '/src/sim/shipgen/stationGen.ts', '/src/sim/shipgen/stationDepartments.ts', '/tools/shipgen/mocks/mockKit.ts', '/tools/shipgen/mocks/mockViews.ts',
    '/src/sim/shipgen/stationHullIntegrity.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts', '/tools/shipgen/png.ts'].map(L));
  const { drawDepartments, drawDeptKey } = views;
  const built = (g) => {
    const { width: W, height: H } = g, rws = g.template.rows;
    const seen = new Uint8Array(W * H), stack = [];
    const push = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H && !seen[y * W + x] && (rws[y]?.[x] ?? '.') === '.') { seen[y * W + x] = 1; stack.push([x, y]); } };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    while (stack.length) { const [x, y] = stack.pop(); push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
    let b = 0, inside = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!seen[y * W + x]) inside++; if ((rws[y]?.[x] ?? '.') !== '.') b++; }
    return Math.round((100 * b) / inside);
  };
  // Which kind uses each grammar most at each tier.
  const use = {};
  for (const [kind, def] of Object.entries(content.stations)) for (const [size, tier] of Object.entries(def.tiers)) for (const g of tier.grammars) {
    if (g.value.startsWith('stationFlow')) continue;
    const cur = use[size]?.[g.value];
    if (!cur || g.weight > cur.weight) ((use[size] ??= {})[g.value] = { kind, weight: g.weight });
  }
  for (const size of ['outpost', 'station', 'hub']) {
    const rows = [];
    for (const [grammar, { kind }] of Object.entries(use[size] ?? {}).sort()) {
      const def = content.stations[kind];
      const d2 = { ...def, tiers: { ...def.tiers, [size]: { ...def.tiers[size], grammars: [{ value: grammar, weight: 1 }] } } };
      const row = [];
      for (const seed of seeds) {
        let g;
        try { g = sg.generateStation(d2, kind, size, seed, content.modules, true, 'off'); } catch (e) { console.log(`${size} ${grammar} ${kind} seed ${seed}: FAILED ${String(e).slice(0, 120)}`); continue; }
        g.depts = g.rooms.map((rm) => (rm.role === 'hall' ? 'circulation' : rm.role === 'plaza' ? 'commons' : dep.deptOf({ role: rm.role })));
        const hull = stationHullIntegrityProblems(g.template), floor = [...g.roomOf].filter((k) => k >= 0).length, pct = built(g);
        console.log(`${size} ${grammar.replace('station', '')} (${kind.replace('station.', '')}) seed ${seed}: ${g.profile} | ${g.width}x${g.height}, floor ${floor}, rooms ${g.rooms.length}, built ${pct}%, 2x2 ${wallBlocks(g).length}, hull ${hull.length ? hull[0].replace('graph-wheel ', '') : 'ok'}, problems ${g.problems.length}${g.problems.length ? `: ${g.problems.slice(0, 2).join('; ').slice(0, 140)}` : ''}`);
        row.push({ title: `${grammar.replace('station', '').toUpperCase()} - ${kind.replace('station.', '')} ${size} seed ${seed} - ${pct} PCT BUILT`, g });
      }
      if (row.length) rows.push(row);
    }
    if (rows.length === 0) continue;
    const all = rows.flat();
    const S = size === 'hub' ? 3 : 4, PAD = 20, TOP = 26, KEY = 28;
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, i) => Math.max(...rows.map((r) => (r[i] ? r[i].g.width : 0))) * S + PAD);
    const rowH = rows.map((r) => Math.max(...r.map((p) => p.g.height)) * S + PAD + 14);
    const xOf = (i) => PAD + colW.slice(0, i).reduce((a, b) => a + b, 0), yOf = (j) => TOP + rowH.slice(0, j).reduce((a, b) => a + b, 0);
    for (const [view, draw] of [['silhouette', (r, g, x, y) => drawSilhouette(r, g, x, y, S)], ['structure', (r, g, x, y) => drawStructure(r, g, x, y, S)], ['departments', (r, g, x, y) => drawDepartments(r, g, g.depts, x, y, S)]]) {
      const sheet = new Raster(xOf(cols) + PAD, yOf(rows.length) + KEY);
      sheet.text(`station grammars, ${size} tier: ${view}`, PAD, 8, [235, 235, 235], 2);
      rows.forEach((row, j) => row.forEach((p, i) => { sheet.text(p.title, xOf(i), yOf(j), [200, 205, 215], 1); draw(sheet, p.g, xOf(i), yOf(j) + 12); }));
      if (view === 'departments') drawDeptKey(sheet, PAD, yOf(rows.length) + 4);
      writeFileSync(join(out, `${size}-${view}.png`), encodePng(sheet));
    }
    console.log(`  ${size}: ${all.length} stations`);
  }
  console.log(`wrote ${out}`);
} finally { await server.close(); }
