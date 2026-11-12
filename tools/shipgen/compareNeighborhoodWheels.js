#!/usr/bin/env node
/**
 * Native A/B comparison: old bandArcs wheel vs experimental department-neighborhood wheel.
 * IMPORTANT: the arranger can choose another grammar; those cases are reported as
 * FALLBACK, not counted as successful neighborhood-wheel generation.
 *
 * node tools/shipgen/compareNeighborhoodWheels.js station.trading --size station --from 1 --count 12 --out neighborhood.json
 * Requires project node_modules (runs through Vite's TypeScript loader).
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const kind = args[0]?.startsWith('station.') ? args[0] : 'station.trading';
const size = opt('size', 'station');
const from = Math.max(1, Number(opt('from', '1')));
const count = Math.max(1, Number(opt('count', '12')));
const output = opt('out', 'station-neighborhood-comparison.json');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const [{ content }, { generateStation }, { architectureOfGenerated }, { sourceModuleDeficits, departmentAccessOf }, { stationHullIntegrityProblems }, { deptOf }] = await Promise.all([
    server.ssrLoadModule('/src/content/index.ts'), server.ssrLoadModule('/src/sim/shipgen/stationGen.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationArchitecturePlan.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationStructuralIntegration.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationHullIntegrity.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationDepartments.ts'),
  ]);
  const def = content.stations[kind];
  if (!def) throw new Error(`unknown station kind: ${kind}`);
  const results = [];
  for (let seed = from; seed < from + count; seed++) {
    const modes = {};
    for (const mode of ['off', 'neighborhood']) {
      const t0 = performance.now();
      const r = generateStation(def, kind, size, seed, content.modules, true, mode);
      const p = architectureOfGenerated(r);
      // Finished layout inference only. During construction, original spec.dept
      // is preserved in the StationArchitecturePlan; it is not preserved here.
      for (const region of p.regions) if (region.kind === 'room' && region.role)
        region.department = deptOf({ role: region.role, w: 1, h: 1, mods: [] });
      const audit = p.audit(), access = departmentAccessOf(p);
      modes[mode] = {
        elapsedMs: +(performance.now() - t0).toFixed(1),
        topology: r.topology,
        actualNeighborhoodWheel: mode === 'neighborhood' && r.topology.startsWith('stationWheel') && r.topology.includes('neighborhoods'),
        nativeProblems: r.problems,
        missingSourceModules: sourceModuleDeficits(r.architecture?.sourceRequirements ?? [], r.template.modules ?? []),
        roomCount: audit.rooms, directPublicAccess: audit.directPublicRoomAccess,
        departmentAccess: access.accessibleNeighborhoods, totalDepartments: access.neighborhoods,
        wallSlabs: audit.wallSlabs, hullProblems: stationHullIntegrityProblems(r.template),
        floorTiles: audit.floorTiles, roomHullFrontage: audit.roomHullFrontage,
        modules: r.template.modules?.length ?? 0,
        signature: createHash('sha256').update(JSON.stringify([r.template.rows, r.template.modules, r.problems, r.topology, r.roomOf])).digest('hex'),
      };
    }
    results.push({ kind, size, seed, modes });
    const a = modes.off, b = modes.neighborhood;
    console.log(`${kind} ${size} seed ${seed}: ${b.actualNeighborhoodWheel ? 'NEIGHBORHOOD WHEEL' : 'FALLBACK ' + b.topology.split(' ')[0]}, ` +
      `floor ${a.floorTiles}->${b.floorTiles}, slabs ${a.wallSlabs}->${b.wallSlabs}, ` +
      `hull problems ${a.hullProblems.length}->${b.hullProblems.length}, ` +
      `source deficits ${a.missingSourceModules.length}->${b.missingSourceModules.length}`);
  }
  writeFileSync(resolve(output), JSON.stringify(results, null, 2));
  console.log(`${results.filter((x) => x.modes.neighborhood.actualNeighborhoodWheel).length}/${results.length} actual neighborhood wheels; saved ${resolve(output)}`);
} finally { await server.close(); }
