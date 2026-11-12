#!/usr/bin/env node
/**
 * Station assembly sheets: the recipes of src/content/stationRecipes.ts, assembled for several seeds and drawn through
 * the original views (silhouette, structure, departments). Unfurnished: composition first.
 *   node tools/shipgen/assemblySheets.js [--seeds 1,2,3,4] [--out dir] [--family tree] [--program station.research:hub] [--versus]
 *   (--versus: the old grammar as the first row; --program: another kind and size than the family's own)
 * One set of sheets per family (tree: the pirate hub's rooms; spine and compound: the mining station's). A row per recipe
 * variation, a column per seed. Nothing is filtered: a seed that cannot be assembled shows as a rejected panel.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (f, d) => { const i = args.indexOf(`--${f}`); return i < 0 ? d : args[i + 1]; };
const seeds = arg('seeds', '1,2,3,4').split(',').map(Number);
const out = resolve(arg('out', 'tools/shipgen/out/assembly'));
mkdirSync(out, { recursive: true });
const VERSUS = { tree: 'stationTree', spine: 'stationSpine' };
const PROGRAM = { tree: ['station.pirate', 'hub'], spine: ['station.mining', 'station'], compound: ['station.mining', 'station'] };
const only = arg('family', '');

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  const chunk = (type, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(type), d]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const L = (p) => server.ssrLoadModule(p);
  const [{ content }, { stationRecipes }, sg, { Rng }, gen, { deptOf }, { stationProgram }, { assemble }, views, { hullProblems }, { Raster }, { drawStructure, drawSilhouette }] = await Promise.all([
    '/src/content/index.ts', '/src/content/stationRecipes.ts', '/src/sim/shipgen/stationGen.ts', '/src/sim/rng.ts', '/src/sim/shipgen/generate.ts',
    '/src/sim/shipgen/assembly/dept.ts', '/src/sim/shipgen/assembly/program.ts', '/src/sim/shipgen/assembly/assemble.ts', '/tools/shipgen/assemblyViews.ts',
    '/src/sim/shipgen/assembly/hull.ts', '/tools/shipgen/draw.ts', '/tools/shipgen/views.ts'].map(L));
  const { roomCores, drawDepartments, drawDeptKey, wallBlocks } = views;
  const roomsFor = (kind, size, seed) => {
    const rng = new Rng(gen.seedOf(seed, 0));
    return { rng, rooms: stationProgram(rng, content.stations[kind], size, content.modules) };
  };
  // What a room is, short enough to stand in it: by what it holds first, then by its role.
  const NAME = { bridge: 'BRIDGE', armoury: 'ARMS', dock: 'DOCK', medbay: 'MED', reactor: 'REACT', shields: 'SHLD', core: 'CORE', plant: 'PLANT', weapons: 'GUN', industry: 'REFINE', farm: 'FARM', hangar: 'BAY', cargo: 'CARGO', support: 'COMMON' };
  const nameOf = (r) => {
    const mods = r.spec?.mods ?? [], has = (m) => mods.includes(`module.${m}`), beds = mods.filter((m) => m === 'module.bed').length;
    if (has('galley')) return 'MESS';
    if (has('bed') && has('mess_table')) return 'CHIEF';
    if (has('research')) return 'LAB';
    if (has('scrapper')) return 'BREAK';
    if (has('fabricator')) return 'SHOP';
    if (has('battery')) return 'BATT';
    if (has('recovery')) return 'TRAUMA';
    if (has('droneBay')) return 'DRONES';
    if (has('vehicle_bay')) return 'SHUTTLE';
    if (r.role === 'support' && has('storage_locker')) return 'SUITS';
    if (r.role === 'cargo' && has('storage_rack')) return 'PANTRY';
    if (has('arcade')) return 'REC';
    if (has('pod_bay')) return 'PODS';
    if (has('storage_ore')) return 'ORE';
    if (r.role === 'quarters') return beds > 1 ? `B${beds}` : 'C';
    return NAME[r.role] ?? r.role.toUpperCase();
  };
  const asResult = (a) => {
    const g = a.ctx.g, snap = g.snapshot();
    return {
      template: { rows: snap.rows, modules: [] }, rooms: g.regions.map((r) => ({ role: r.role })), roomOf: snap.roomOf, width: snap.width, height: snap.height,
      // Streets and halls are circulation whatever department they run through.
      depts: g.regions.map((r) => (r.hall ? (r.dept === 'customs' || r.dept === 'airlock' ? r.dept : 'circulation') : r.dept ?? deptOf({ role: r.role }))), targets: [],
      names: g.regions.map((r) => (r.hall ? (r.dept === 'customs' ? 'CUSTOMS' : undefined) : nameOf(r))),
    };
  };
  for (const [family, recipes] of Object.entries(stationRecipes)) {
    if (only && family !== only) continue;
    const [kind, size] = arg('program') ? arg('program').split(':') : PROGRAM[family];
    const rows = [];
    // --versus: the old grammar for the same rooms and seeds as the first row, through the whole old pipeline.
    if (args.includes('--versus') && VERSUS[family]) {
      const def = content.stations[kind];
      const d2 = { ...def, tiers: { ...def.tiers, [size]: { ...def.tiers[size], grammars: [{ value: VERSUS[family], weight: 1 }] } } };
      rows.push(seeds.map((seed) => {
        const g = sg.generateStation(d2, kind, size, seed, content.modules);
        g.depts = g.rooms.map((rm) => (rm.role === 'hall' ? 'circulation' : rm.role === 'plaza' ? 'commons' : deptOf({ role: rm.role })));
        const floor = [...g.roomOf].filter((k) => k >= 0).length;
        console.log(`${family} | OLD ${VERSUS[family]} | seed ${seed}: ${g.width}x${g.height}, rooms ${g.rooms.length}, floor ${floor}, 2x2 ${wallBlocks(g).length}`);
        return { title: `OLD ${VERSUS[family].replace('station', '').toUpperCase()} - seed ${seed} - ${g.width}x${g.height}`, g };
      }));
    }
    for (const recipe of recipes) {
      const row = [];
      for (const seed of seeds) {
        const { rng, rooms } = roomsFor(kind, size, seed);
        const t0 = performance.now();
        const { ok, rejected } = assemble(rng, recipe, rooms);
        const ms = Math.round(performance.now() - t0);
        if (!ok) { console.log(`${family} | ${recipe.name} | seed ${seed}: REJECTED after ${rejected.length} tries, ${ms} ms\n   ${rejected.join('\n   ')}`); row.push({ title: `REJECTED seed ${seed}: ${rejected[rejected.length - 1]}`, g: null }); continue; }
        const g = asResult(ok);
        const beams = g.template.rows.join('').split('=').length - 1;
        // Beams are open structure: for the hull check they are space.
        const hull = hullProblems({ ...g.template, rows: g.template.rows.map((r) => r.replace(/=/g, '.')) }), thin = roomCores(g).filter((c) => Math.min(c.w, c.h) < 3).length;
        console.log(`${family} | ${recipe.name} | seed ${seed}: ${g.width}x${g.height}${ok.R ? `, R ${ok.R}` : ''}, sections ${ok.sections}, corridors ${ok.corridors}, rooms ${ok.rooms}/${rooms.length} placed, floor ${[...g.roomOf].filter((k) => k >= 0).length}, 2x2 ${wallBlocks(g).length}, hull ${hull[0] ?? 'ok'}, under 3 wide ${thin}, beams ${beams}, rejected first ${rejected.length}${rejected.length ? ` (${rejected[0]})` : ''}, ${ms} ms`);
        row.push({ title: `${recipe.name.toUpperCase()} - seed ${seed} - ${g.width}x${g.height}`, g });
      }
      rows.push(row);
    }
    const S = 4, PAD = 20, TOP = 26, KEY = 28;
    const cols = Math.max(...rows.map((r) => r.length));
    const colW = Array.from({ length: cols }, (_, i) => Math.max(120, ...rows.map((r) => (r[i]?.g ? r[i].g.width : 0))) * S + PAD);
    const rowH = rows.map((r) => Math.max(40, ...r.map((p) => (p.g ? p.g.height : 0))) * S + PAD + 14);
    const xOf = (i) => PAD + colW.slice(0, i).reduce((a, b) => a + b, 0), yOf = (j) => TOP + rowH.slice(0, j).reduce((a, b) => a + b, 0);
    for (const [view, draw] of [['silhouette', (r, g, x, y) => drawSilhouette(r, g, x, y, S)], ['structure', (r, g, x, y) => drawStructure(r, g, x, y, S)], ['departments', (r, g, x, y) => drawDepartments(r, g, g.depts, x, y, S)], ['rooms', (r, g, x, y) => drawDepartments(r, g, g.depts, x, y, S, g.names)]]) {
      const sheet = new Raster(xOf(cols) + PAD, yOf(rows.length) + KEY);
      sheet.text(`station assembly, ${family} (${kind} ${size}): ${view}`, PAD, 8, [235, 235, 235], 2);
      rows.forEach((row, j) => row.forEach((p, i) => { sheet.text(p.title.slice(0, Math.floor(colW[i] / 4.2)), xOf(i), yOf(j), p.g ? [200, 205, 215] : [255, 120, 120], 1); if (p.g) draw(sheet, p.g, xOf(i), yOf(j) + 12); }));
      if (view === 'departments' || view === 'rooms') drawDeptKey(sheet, PAD, yOf(rows.length) + 4);
      writeFileSync(join(out, `${family}-${view}.png`), encodePng(sheet));
    }
  }
  console.log(`wrote ${out}`);
} finally { await server.close(); }
