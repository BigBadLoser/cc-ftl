#!/usr/bin/env node
/**
 * Native A/B/C comparison rendered through the ORIGINAL tools/shipgen/labels.ts.
 *
 * node tools/shipgen/compareProgramBays.js station.trading --size station --from 1 --count 8 --out tools/shipgen/out/program-bays
 *
 * The wheel grammar is FORCED in all three modes; failures are recorded as
 * failures, not counted as successful runs of a different station family.
 * Requires the project's normal node_modules / Vite SSR loader.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const arg = (flag, fallback) => { const at = args.indexOf(`--${flag}`); return at < 0 ? fallback : args[at + 1]; };
const kind = args[0]?.startsWith('station.') ? args[0] : 'station.trading';
const size = arg('size', 'station');
const first = Math.max(1, Number(arg('from', 1)));
const count = Math.max(1, Number(arg('count', 8)));
const out = resolve(arg('out', 'tools/shipgen/out/program-bays'));
mkdirSync(out, { recursive: true });

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const [{ content }, { generateStation }, { architectureOfGenerated }, { sourceModuleDeficits }, { stationHullIntegrityProblems }, { labelResult }, { Raster }, { drawStructure, drawSilhouette }, { encodePng }] = await Promise.all([
    server.ssrLoadModule('/src/content/index.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationGen.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationArchitecturePlan.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationStructuralIntegration.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationHullIntegrity.ts'),
    server.ssrLoadModule('/tools/shipgen/labels.ts'),
    server.ssrLoadModule('/tools/shipgen/draw.ts'),
    server.ssrLoadModule('/tools/shipgen/views.ts'),
    server.ssrLoadModule('/tools/shipgen/png.ts'),
  ]);
  const original = content.stations[kind];
  if (!original) throw new Error(`unknown station: ${kind}`);
  const def = { ...original, tiers: { ...original.tiers, [size]: {
    ...original.tiers[size], grammars: [{ value: 'stationWheel', weight: 1 }],
  } } };
  const rows = [];
  for (let seed = first; seed < first + count; seed++) {
    const modes = {};
    for (const mode of ['off', 'neighborhood', 'programBay']) {
      const start = performance.now();
      try {
        const r = generateStation(def, kind, size, seed, content.modules, true, mode);
        const audit = architectureOfGenerated(r).audit();
        const expected = mode === 'programBay' ? 'programBays' : mode === 'neighborhood' ? 'neighborhoods' : 'stationWheel';
        const correctGrammar = r.topology.startsWith('stationWheel') && r.topology.includes(expected);
        modes[mode] = {
          ms: +(performance.now() - start).toFixed(1), correctGrammar, topology: r.topology,
          nativeProblems: r.problems, sourceDeficits: sourceModuleDeficits(r.architecture?.sourceRequirements ?? [], r.template.modules ?? []),
          floorTiles: audit.floorTiles, wallSlabs: audit.wallSlabs,
          directPublicRooms: audit.directPublicRoomAccess, totalRooms: audit.rooms,
          hullProblems: stationHullIntegrityProblems(r.template),
          moduleCount: r.template.modules?.length ?? 0,
          signature: createHash('sha256').update(JSON.stringify([r.template.rows, r.template.modules, r.roomOf, r.topology])).digest('hex'),
        };
        if (!correctGrammar) continue;
        const base = `${kind}-${size}-s${seed}-${mode}`;
        const labels = labelResult(r, `${kind} ${size} seed ${seed} ${mode}`, 16);
        writeFileSync(join(out, `${base}-labels.png`), encodePng(labels));
        for (const [name, draw] of [['structure', drawStructure], ['silhouette', drawSilhouette]]) {
          const raster = new Raster(r.width * 12, r.height * 12);
          draw(raster, r, 0, 0, 12);
          writeFileSync(join(out, `${base}-${name}.png`), encodePng(raster));
        }
      } catch (e) { modes[mode] = { failure: String(e?.stack ?? e) }; }
    }
    rows.push({ kind, size, seed, modes });
    console.log(`${kind} ${size} seed ${seed}: ` + ['off', 'neighborhood', 'programBay'].map(m => {
      const a = modes[m];
      return `${m} ${a.correctGrammar ? `${a.floorTiles} tiles, ${a.wallSlabs} slabs, ${a.hullProblems.length} hull errors` : `FAIL (${a.topology || a.failure})`}`;
    }).join(' | '));
  }
  writeFileSync(join(out, 'metrics.json'), JSON.stringify(rows, null, 2));
  console.log(`Saved original-renderer sheets and metrics to ${out}`);
} finally { await server.close(); }
