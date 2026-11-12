#!/usr/bin/env node
/**
 * Render the hand-designed station skeleton mocks through the original shipgen views.
 *   node tools/shipgen/mocks/render.js [--out dir] [--only name,name] [--legacy station.trading:1]
 * Per mock: <name>-labels.png (labels.ts, 2x2 wall blocks framed red) and a sheet.png of every mock's silhouette and
 * structure side by side. Prints the hull check, 2x2 count and room problems.
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
  const [{ MOCKS }, { wallBlocks, roomProblems }, { stationHullIntegrityProblems }, { labelResult }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }] =
    await Promise.all(['/tools/shipgen/mocks/index.ts', '/tools/shipgen/mocks/mockKit.ts', '/src/sim/shipgen/stationHullIntegrity.ts',
      '/tools/shipgen/labels.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts', '/tools/shipgen/png.ts'].map(load));
  const results = [];
  if (legacy) {
    const [{ content }, { generateStation }] = await Promise.all([load('/src/content/index.ts'), load('/src/sim/shipgen/stationGen.ts')]);
    const [kind, seed] = legacy.split(':');
    const o = content.stations[kind];
    const def = { ...o, tiers: { ...o.tiers, station: { ...o.tiers.station, grammars: [{ value: 'stationWheel', weight: 1 }] } } };
    results.push({ name: 'legacy', title: `legacy ${kind} seed ${seed}`, g: generateStation(def, kind, 'station', Number(seed), content.modules, true, 'off') });
  }
  for (const m of MOCKS) if (!only.length || only.includes(m.name)) results.push({ name: m.name, title: m.title, g: m.make() });

  const S = 6, PAD = 24, TOP = 30;
  const cellW = Math.max(...results.map((r) => r.g.width)) * S + PAD, cellH = Math.max(...results.map((r) => r.g.height)) * S + PAD;
  const sheet = new Raster(results.length * cellW + PAD, 2 * cellH + TOP + PAD);
  results.forEach(({ name, title, g }, i) => {
    const blocks = wallBlocks(g);
    const hull = stationHullIntegrityProblems(g.template);
    const problems = name === 'legacy' ? [] : roomProblems(g);
    const lab = labelResult(g, `${title} - ${blocks.length} red 2x2`, 16);
    for (const b of blocks) lab.frame(b.x * 16, 40 + b.y * 16, 32, 32, [255, 40, 40], 3);
    writeFileSync(join(out, `${name}-labels.png`), encodePng(lab));
    const ox = PAD + i * cellW;
    sheet.text(name, ox, 10, [235, 235, 235], 3);
    drawSilhouette(sheet, g, ox, TOP, S);
    drawStructure(sheet, g, ox, TOP + cellH, S);
    for (const b of blocks) sheet.frame(ox + b.x * S, TOP + cellH + b.y * S, 2 * S, 2 * S, [255, 40, 40], 2);
    const floor = [...g.roomOf].filter((k) => k >= 0).length;
    console.log(`${name}: ${g.width}x${g.height}, ${floor} floor, ${g.rooms.length} regions, ${blocks.length} 2x2, hull: ${hull[0] ?? 'ok'}`);
    for (const p of problems.slice(0, 12)) console.log(`   ${p}`);
    if (problems.length > 12) console.log(`   ... ${problems.length - 12} more`);
  });
  writeFileSync(join(out, 'sheet.png'), encodePng(sheet));
  console.log(`wrote ${out}`);
} finally { await server.close(); }
