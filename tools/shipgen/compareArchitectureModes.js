#!/usr/bin/env node
/**
 * Reproducible A/B/C test on the SAME seed and native furnished game layout.
 *
 * node tools/shipgen/compareArchitectureModes.js station.trading --size station --from 1 --count 12 --out /tmp/architecture-modes.json
 * The default game mode ('off') is never changed by this command.
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
const output = opt('out', 'station-architecture-mode-comparison.json');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const [{ content }, { generateStation }, { architectureOfGenerated }, { departmentAccessOf, sourceModuleDeficits }, { deptOf }, { stationHullIntegrityProblems }] = await Promise.all([
    server.ssrLoadModule('/src/content/index.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationGen.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationArchitecturePlan.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationStructuralIntegration.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationDepartments.ts'),
    server.ssrLoadModule('/src/sim/shipgen/stationHullIntegrity.ts'),
  ]);
  const def = content.stations[kind];
  if (!def) throw new Error(`unknown station kind: ${kind}`);
  const records = [];
  for (let seed = from; seed < from + count; seed++) {
    const modes = {};
    for (const mode of ['off', 'compile', 'ranked']) {
      const t0 = performance.now();
      const result = generateStation(def, kind, size, seed, content.modules, true, mode);
      const p = architectureOfGenerated(result);
      // Final furnished layouts have no original department IDs; role-derived
      // departments are an approximation. Candidate mode uses exact spec.dept.
      for (const r of p.regions) if (r.kind === 'room' && r.role)
        r.department = deptOf({ role: r.role, w: 1, h: 1, mods: [] });
      const report = p.audit(), departments = departmentAccessOf(p);
      modes[mode] = {
        elapsedMs: Number((performance.now() - t0).toFixed(1)),
        hash: createHash('sha256').update(JSON.stringify([result.template.rows, result.template.modules, result.problems, result.topology, result.roomOf])).digest('hex'),
        problems: result.problems, topology: result.topology,
        generatedRooms: report.rooms, roomIndependentAccess: report.independentPublicRoomAccess,
        departmentNeighborhoods: departments.neighborhoods, departmentIndependentAccess: departments.accessibleNeighborhoods,
        generatedModules: result.template.modules?.length ?? 0,
        V2HullFailures: stationHullIntegrityProblems(result.template),
        wallSlabs: report.wallSlabs, construction: result.architecturalConstruction ?? null,
        missingSourceModules: sourceModuleDeficits(result.architecture?.sourceRequirements ?? [], result.template.modules ?? []),
      };
    }
    records.push({ kind, size, seed, modes });
    const { off, compile, ranked } = modes;
    console.log(`${kind} ${size} ${seed}: compile=${off.hash === compile.hash ? 'identical' : 'changed'}, ranked=${off.hash === ranked.hash ? 'identical' : 'changed'}; ` +
      `department neighborhoods ${off.departmentIndependentAccess}/${off.departmentNeighborhoods} -> ${ranked.departmentIndependentAccess}/${ranked.departmentNeighborhoods}; ` +
      `remaining hull failures ${ranked.V2HullFailures.length}`);
  }
  writeFileSync(resolve(output), JSON.stringify(records, null, 2));
  console.log(`Saved ${records.length} three-mode comparison records: ${resolve(output)}`);
} finally { await server.close(); }
