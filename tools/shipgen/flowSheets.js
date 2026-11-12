#!/usr/bin/env node
/**
 * Flow planner sheets: the structures the planner finds for each flow, drawn through the original shipgen views
 * (silhouette, structure, departments; labels.ts for each one), beside the legacy generator and the hand-designed
 * mocks. Unfurnished: this is the massing, for the eye, before any construction detail.
 *   node tools/shipgen/flowSheets.js [--kind station.trading] [--size station] [--seed 1] [--picks 3] [--out dir]
 * Columns: the best skeletons of each flow for one seed (pick 0, 1, 2). Last row: legacy and the mocks.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(`--${f}`); return i < 0 ? d : args[i + 1]; };
const kind = arg('kind', 'station.trading'), size = arg('size', 'station'), seed = Number(arg('seed', 1)), picks = Number(arg('picks', 3));
const out = resolve(arg('out', 'tools/shipgen/out/flows'));
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const L = (p) => server.ssrLoadModule(p);
  const [{ content }, { stationFlows }, sg, { planStation }, { Rng }, gen, dep, kit, { planFlow }, { MOCKS }, { wallBlocks }, views, { stationHullIntegrityProblems }, { labelResult }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }] = await Promise.all([
    '/src/content/index.ts', '/src/content/stationFlows.ts', '/src/sim/shipgen/stationGen.ts', '/src/sim/shipgen/stationPlan.ts', '/src/sim/rng.ts', '/src/sim/shipgen/generate.ts',
    '/src/sim/shipgen/stationDepartments.ts', '/src/sim/shipgen/stationKit.ts', '/src/sim/shipgen/flow/planner.ts', '/tools/shipgen/mocks/index.ts', '/tools/shipgen/mocks/mockKit.ts',
    '/tools/shipgen/mocks/mockViews.ts', '/src/sim/shipgen/stationHullIntegrity.ts', '/tools/shipgen/labels.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts', '/tools/shipgen/png.ts'].map(L));
  const { roomCores, drawDepartments, drawDeptKey } = views;
  const def = content.stations[kind];
  const f = sg.stationFaction(def, size), fam = f.hullFamilies[0];
  const roomsFor = (sd) => {
    const rng = new Rng(gen.seedOf(sd, 0));
    const plan = planStation(rng, def, size, { id: size, weight: fam.weight, archetypes: [] }, content.modules, 0);
    return { rng, rooms: dep.tagged(dep.warehoused([{ ...plan.command, pinned: true }, ...kit.fullRooms({ rng, plan, fam })])) };
  };
  // A planned site as the views' input: rows, the region of each floor tile, roles and departments.
  const asResult = (p) => {
    const snap = p.site.g.snapshot();
    const regions = p.site.g.regions;
    return {
      template: { rows: snap.rows, modules: [] }, rooms: regions.map((r) => ({ role: r.role })), roomOf: snap.roomOf, width: snap.width, height: snap.height,
      depts: regions.map((r) => r.dept ?? (r.hall ? (r.role === 'hall' ? 'circulation' : 'commons') : dep.deptOf({ role: r.role }))), targets: [],
    };
  };
  const rows = [];
  for (const [id, flow] of Object.entries(stationFlows)) {
    const row = [];
    for (let pick = 0; pick < picks; pick++) {
      const { rng, rooms } = roomsFor(seed);
      const trace = [];
      const t0 = performance.now();
      const p = planFlow(rng, flow, rooms, { pick, trace });
      if (!p) { console.log(`${id} pick ${pick}: NO STRUCTURE\n   ${trace.slice(0, 6).join('\n   ')}`); continue; }
      if (pick > 0 && row.some((q) => q.plan.skeleton === p.skeleton)) continue; // fewer skeletons than picks
      const g = asResult(p);
      const blocks = wallBlocks(g), hull = stationHullIntegrityProblems(g.template);
      const thin = roomCores(g).filter((c) => Math.min(c.w, c.h) < 3).length;
      console.log(`${id} pick ${pick}: ${p.skeleton}\n   R ${p.R}, score ${p.score.toFixed(1)}, ${g.width}x${g.height}, floor ${[...g.roomOf].filter((k) => k >= 0).length}, spare strips ${p.spare}, bare street ${p.bare}, shops ${p.shops}, spilled ${p.spilled}, 2x2 ${blocks.length}, hull ${hull[0] ?? 'ok'}, under 3 wide ${thin}, loose rooms ${p.loose.length}, ${Math.round(performance.now() - t0)} ms`);
      console.log(`   sized by: ${p.smaller.join(' | ') || 'the smallest radius tried'}`);
      if (pick === 0) console.log(`   other skeletons: ${p.others.slice(0, 5).join(' | ') || 'none'}\n   rejected ${p.rejected.length}${p.rejected.length ? `: ${p.rejected.slice(0, 3).join(' | ')}` : ''}`);
      row.push({ name: `${id.split('.').pop()}-${pick}`, title: `${flow.name}: ${p.skeleton}`, g, plan: p });
    }
    rows.push(row);
  }
  // References: the legacy wheel for this seed, and the hand-designed mocks.
  const refs = [];
  {
    const d2 = { ...def, tiers: { ...def.tiers, [size]: { ...def.tiers[size], grammars: [{ value: 'stationWheel', weight: 1 }] } } };
    const g = sg.generateStation(d2, kind, size, seed, content.modules, true, 'off');
    g.depts = g.rooms.map((rm) => (rm.role === 'hall' ? 'circulation' : rm.role === 'plaza' ? 'commons' : dep.deptOf({ role: rm.role })));
    refs.push({ name: 'legacy', title: `legacy wheel seed ${seed}`, g });
    for (const m of MOCKS.filter((q) => ['tradingA', 'tradingB'].includes(q.name))) refs.push({ name: `mock-${m.name}`, title: `hand-designed: ${m.title}`, g: m.make() });
  }
  rows.push(refs);

  const S = 5, PAD = 20, TOP = 26, KEY = 28;
  const all = rows.flat();
  // How full each station is: built tiles as a share of everything inside its outer hull (voids count against it).
  for (const p of all) {
    const { width: W, height: H } = p.g, rws = p.g.template.rows;
    const out = new Uint8Array(W * H), stack = [];
    const push = (x, y) => { if (x >= 0 && y >= 0 && x < W && y < H && !out[y * W + x] && (rws[y]?.[x] ?? '.') === '.') { out[y * W + x] = 1; stack.push([x, y]); } };
    for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1); }
    for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y); }
    while (stack.length) { const [x, y] = stack.pop(); push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
    let built = 0, inside = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!out[y * W + x]) inside++; if ((rws[y]?.[x] ?? '.') !== '.') built++; }
    p.built = Math.round((100 * built) / inside);
    p.title = `${p.built} PCT BUILT - ${p.title}`;
    console.log(`built ${p.built}%  ${p.name}`);
  }
  const cellW = Math.max(...all.map((r) => r.g.width)) * S + PAD, cellH = Math.max(...all.map((r) => r.g.height)) * S + PAD + 14;
  const cols = Math.max(...rows.map((r) => r.length));
  for (const [view, draw] of [['silhouette', (r, g, x, y) => drawSilhouette(r, g, x, y, S)], ['structure', (r, g, x, y) => drawStructure(r, g, x, y, S)], ['departments', (r, g, x, y) => drawDepartments(r, g, g.depts, x, y, S)]]) {
    const sheet = new Raster(cols * cellW + PAD, rows.length * cellH + TOP + KEY);
    sheet.text(`${kind} ${size} seed ${seed}: ${view}`, PAD, 8, [235, 235, 235], 2);
    rows.forEach((row, j) => row.forEach((p, i) => {
      const ox = PAD + i * cellW, oy = TOP + j * cellH;
      sheet.text(p.title.slice(0, Math.floor(cellW / 4.2)), ox, oy, [200, 205, 215], 1);
      draw(sheet, p.g, ox, oy + 12);
    }));
    if (view === 'departments') drawDeptKey(sheet, PAD, TOP + rows.length * cellH + 4);
    writeFileSync(join(out, `sheet-${view}.png`), encodePng(sheet));
  }
  for (const p of all) {
    const lab = labelResult(p.g, p.title, 12);
    for (const b of wallBlocks(p.g)) lab.frame(b.x * 12, 40 + b.y * 12, 24, 24, [255, 40, 40], 2);
    writeFileSync(join(out, `${p.name}-labels.png`), encodePng(lab));
  }
  console.log(`wrote ${out}`);
} finally { await server.close(); }
