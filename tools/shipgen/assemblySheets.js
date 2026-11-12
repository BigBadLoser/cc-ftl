#!/usr/bin/env node
/**
 * Assembly prototype sheets: the recipes of src/content/stationRecipes.ts, assembled for several seeds and drawn through
 * the original views (silhouette, structure, departments). Unfurnished: composition first.
 *   node tools/shipgen/assemblySheets.js [--seeds 1,2,3,4] [--out dir]
 * One set of sheets per family (tree: the pirate station's rooms; compound: the mining station's). A row per recipe
 * variation, a column per seed. Nothing is filtered: a seed that cannot be assembled shows as a rejected panel.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(`--${f}`); return i < 0 ? d : args[i + 1]; };
const seeds = arg('seeds', '1,2,3,4').split(',').map(Number);
const out = resolve(arg('out', 'tools/shipgen/out/assembly'));
mkdirSync(out, { recursive: true });
const PROGRAM = { tree: ['station.pirate', 'hub'], compound: ['station.mining', 'station'] };

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const L = (p) => server.ssrLoadModule(p);
  const [{ content }, { stationRecipes }, sg, { planStation }, { Rng }, gen, dep, kit, { assemble }, { wallBlocks }, views, { stationHullIntegrityProblems }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }] = await Promise.all([
    '/src/content/index.ts', '/src/content/stationRecipes.ts', '/src/sim/shipgen/stationGen.ts', '/src/sim/shipgen/stationPlan.ts', '/src/sim/rng.ts', '/src/sim/shipgen/generate.ts',
    '/src/sim/shipgen/stationDepartments.ts', '/src/sim/shipgen/stationKit.ts', '/src/sim/shipgen/assembly/assemble.ts', '/tools/shipgen/mocks/mockKit.ts', '/tools/shipgen/mocks/mockViews.ts',
    '/src/sim/shipgen/stationHullIntegrity.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts', '/tools/shipgen/png.ts'].map(L));
  const { roomCores, drawDepartments, drawDeptKey } = views;
  const roomsFor = (kind, size, seed) => {
    const def = content.stations[kind], f = sg.stationFaction(def, size), fam = f.hullFamilies[0];
    const rng = new Rng(gen.seedOf(seed, 0));
    const plan = planStation(rng, def, size, { id: size, weight: fam.weight, archetypes: [] }, content.modules, 0);
    return { rng, rooms: dep.tagged(dep.warehoused([{ ...plan.command, pinned: true }, ...kit.fullRooms({ rng, plan, fam })])) };
  };
  const asResult = (a) => {
    const g = a.ctx.g, snap = g.snapshot();
    return {
      template: { rows: snap.rows, modules: [] }, rooms: g.regions.map((r) => ({ role: r.role })), roomOf: snap.roomOf, width: snap.width, height: snap.height,
      depts: g.regions.map((r) => r.dept ?? (r.hall ? (r.role === 'hall' ? 'circulation' : 'commons') : dep.deptOf({ role: r.role }))), targets: [],
    };
  };
  for (const [family, recipes] of Object.entries(stationRecipes)) {
    const [kind, size] = PROGRAM[family];
    const rows = [];
    for (const recipe of recipes) {
      const row = [];
      for (const seed of seeds) {
        const { rng, rooms } = roomsFor(kind, size, seed);
        const t0 = performance.now();
        const { ok, rejected } = assemble(rng, recipe, rooms);
        const ms = Math.round(performance.now() - t0);
        if (!ok) { console.log(`${family} | ${recipe.name} | seed ${seed}: REJECTED after ${rejected.length} tries, ${ms} ms\n   ${rejected.join('\n   ')}`); row.push({ title: `REJECTED seed ${seed}: ${rejected[rejected.length - 1]}`, g: null }); continue; }
        const g = asResult(ok);
        const hull = stationHullIntegrityProblems(g.template), thin = roomCores(g).filter((c) => Math.min(c.w, c.h) < 3).length;
        console.log(`${family} | ${recipe.name} | seed ${seed}: ${g.width}x${g.height}${ok.R ? `, R ${ok.R}` : ''}, sections ${ok.sections}, corridors ${ok.corridors}, rooms ${ok.rooms}/${rooms.length} placed, floor ${[...g.roomOf].filter((k) => k >= 0).length}, 2x2 ${wallBlocks(g).length}, hull ${hull[0]?.replace('graph-wheel ', '') ?? 'ok'}, under 3 wide ${thin}, rejected first ${rejected.length}${rejected.length ? ` (${rejected[0]})` : ''}, ${ms} ms`);
        row.push({ title: `${recipe.name.toUpperCase()} - seed ${seed}`, g });
      }
      rows.push(row);
    }
    const S = 4, PAD = 20, TOP = 26, KEY = 28;
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, i) => Math.max(120, ...rows.map((r) => (r[i]?.g ? r[i].g.width : 0))) * S + PAD);
    const rowH = rows.map((r) => Math.max(40, ...r.map((p) => (p.g ? p.g.height : 0))) * S + PAD + 14);
    const xOf = (i) => PAD + colW.slice(0, i).reduce((a, b) => a + b, 0), yOf = (j) => TOP + rowH.slice(0, j).reduce((a, b) => a + b, 0);
    for (const [view, draw] of [['silhouette', (r, g, x, y) => drawSilhouette(r, g, x, y, S)], ['structure', (r, g, x, y) => drawStructure(r, g, x, y, S)], ['departments', (r, g, x, y) => drawDepartments(r, g, g.depts, x, y, S)]]) {
      const sheet = new Raster(xOf(cols) + PAD, yOf(rows.length) + KEY);
      sheet.text(`assembly prototype, ${family} (${kind} ${size}): ${view}`, PAD, 8, [235, 235, 235], 2);
      rows.forEach((row, j) => row.forEach((p, i) => { sheet.text(p.title.slice(0, Math.floor(colW[i] / 4.2)), xOf(i), yOf(j), p.g ? [200, 205, 215] : [255, 120, 120], 1); if (p.g) draw(sheet, p.g, xOf(i), yOf(j) + 12); }));
      if (view === 'departments') drawDeptKey(sheet, PAD, yOf(rows.length) + 4);
      writeFileSync(join(out, `${family}-${view}.png`), encodePng(sheet));
    }
  }
  console.log(`wrote ${out}`);
} finally { await server.close(); }
