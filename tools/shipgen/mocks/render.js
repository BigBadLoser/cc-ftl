#!/usr/bin/env node
/**
 * Render the hand-designed station skeleton mocks through the original shipgen views.
 *   node tools/shipgen/mocks/render.js [--out dir] [--only name,name|none] [--legacy station.trading:1,station.farming:outpost:2]
 * Per mock: <name>-labels.png (labels.ts; red = 2x2 wall block, cyan = each room's largest rectangle, yellow = a
 * room under 3 wide) and <name>-depts.png (departments). sheet.png: every mock's silhouette, structure and departments.
 * Prints the hull check, 2x2 count, slivers, rooms far off their program size and room problems.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(`--${f}`); return i < 0 ? d : args[i + 1]; };
const out = resolve(arg('out', 'tools/shipgen/out/mocks'));
const only = arg('only', '')?.split(',').filter(Boolean);
const legacy = arg('legacy', 'station.trading:1');
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const load = (p) => server.ssrLoadModule(p);
  const [{ MOCKS }, { wallBlocks, roomProblems }, views, { stationHullIntegrityProblems }, { labelResult }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }, { deptOf }] =
    await Promise.all(['/tools/shipgen/mocks/index.ts', '/tools/shipgen/mocks/mockKit.ts', '/tools/shipgen/mocks/mockViews.ts',
      '/src/sim/shipgen/stationHullIntegrity.ts', '/tools/shipgen/labels.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts',
      '/tools/shipgen/png.ts', '/src/sim/shipgen/stationDepartments.ts'].map(load));
  const { roomCores, drawDepartments, drawDeptKey } = views;
  const results = [];
  if (legacy) {
    // Each entry: station.<kind>:<seed> or station.<kind>:<size>:<seed>; the wheel grammar is forced.
    const [{ content }, { generateStation }] = await Promise.all([load('/src/content/index.ts'), load('/src/sim/shipgen/stationGen.ts')]);
    for (const entry of legacy.split(',')) {
      const parts = entry.split(':');
      const kind = parts[0], size = parts.length > 2 ? parts[1] : 'station', seed = Number(parts[parts.length - 1]);
      const o = content.stations[kind];
      const def = { ...o, tiers: { ...o.tiers, [size]: { ...o.tiers[size], grammars: [{ value: 'stationWheel', weight: 1 }] } } };
      const g = generateStation(def, kind, size, seed, content.modules, true, 'off');
      g.depts = g.rooms.map((rm) => (rm.role === 'hall' ? 'circulation' : rm.role === 'plaza' ? 'commons' : deptOf({ role: rm.role })));
      g.targets = [];
      const short = `${kind.replace('station.', '')}-${size}-s${seed}`;
      results.push({ name: `legacy-${short}`, title: `legacy ${kind} ${size} seed ${seed} (${g.topology.split(' ')[0]})`, g, legacy: true });
      if (g.problems.length) console.log(`   ${short} native problems: ${g.problems.join('; ')}`);
    }
  }
  for (const m of MOCKS) if (!only.length || only.includes(m.name)) results.push({ name: m.name, title: m.title, g: m.make() });

  const S = 6, PAD = 24, TOP = 30, KEY = 30;
  const cellW = Math.max(...results.map((r) => r.g.width)) * S + PAD, cellH = Math.max(...results.map((r) => r.g.height)) * S + PAD;
  const sheet = new Raster(results.length * cellW + PAD, 3 * cellH + TOP + KEY + PAD);
  drawDeptKey(sheet, PAD, TOP + 3 * cellH + 4);
  results.forEach(({ name, title, g }, i) => {
    const blocks = wallBlocks(g);
    const hull = stationHullIntegrityProblems(g.template);
    const problems = name.startsWith('legacy') ? [] : roomProblems(g);
    const cores = roomCores(g);
    const slivers = cores.filter((c) => Math.min(c.w, c.h) < 3);
    const off = cores.filter((c) => g.targets[c.room] && (c.floor / g.targets[c.room] < 0.6 || c.floor / g.targets[c.room] > 1.6));
    const lab = labelResult(g, `${title} - ${blocks.length} red 2x2, ${slivers.length} under 3 wide`, 16);
    for (const c of cores) lab.frame(c.x * 16 + 2, 40 + c.y * 16 + 2, c.w * 16 - 4, c.h * 16 - 4, Math.min(c.w, c.h) < 3 ? [255, 230, 40] : [90, 230, 255], 2);
    for (const b of blocks) lab.frame(b.x * 16, 40 + b.y * 16, 32, 32, [255, 40, 40], 3);
    writeFileSync(join(out, `${name}-labels.png`), encodePng(lab));
    const dv = new Raster(g.width * 12 + 2 * PAD, g.height * 12 + TOP + KEY + PAD);
    dv.text(`${title} - departments`, PAD, 8, [235, 235, 235], 3);
    drawDepartments(dv, g, g.depts, PAD, TOP, 12);
    drawDeptKey(dv, PAD, TOP + g.height * 12 + 6);
    writeFileSync(join(out, `${name}-depts.png`), encodePng(dv));
    const ox = PAD + i * cellW;
    sheet.text(name, ox, 10, [235, 235, 235], 3);
    drawSilhouette(sheet, g, ox, TOP, S);
    drawStructure(sheet, g, ox, TOP + cellH, S);
    for (const b of blocks) sheet.frame(ox + b.x * S, TOP + cellH + b.y * S, 2 * S, 2 * S, [255, 40, 40], 2);
    drawDepartments(sheet, g, g.depts, ox, TOP + 2 * cellH, S);
    const floor = [...g.roomOf].filter((k) => k >= 0).length;
    const coreShare = cores.reduce((t, c) => t + c.area, 0) / Math.max(1, cores.reduce((t, c) => t + c.floor, 0));
    console.log(`${name}: ${g.width}x${g.height}, ${floor} floor, ${blocks.length} 2x2, hull: ${hull[0] ?? 'ok'}, core share ${(coreShare * 100).toFixed(0)}%`);
    const where = (c) => `${g.rooms[c.room]?.role} #${c.room} at ${c.x},${c.y}`;
    for (const c of slivers) console.log(`   sliver: ${where(c)} core ${c.w}x${c.h}`);
    for (const c of off) console.log(`   size: ${where(c)} floor ${c.floor} vs program ${g.targets[c.room]}`);
    for (const p of problems.slice(0, 12)) console.log(`   ${p}`);
    if (problems.length > 12) console.log(`   ... ${problems.length - 12} more`);
  });
  writeFileSync(join(out, 'sheet.png'), encodePng(sheet));
  console.log(`wrote ${out}`);
} finally { await server.close(); }
