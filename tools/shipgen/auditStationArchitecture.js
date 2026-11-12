#!/usr/bin/env node
/**
 * Full-template station architecture diagnostic, using the actual game pipeline.
 * node tools/shipgen/auditStationArchitecture.js station.trading --size station --from 1 --count 12 --out /tmp/station-audit.json
 * node tools/shipgen/auditStationArchitecture.js station.mining --size hub --from 1 --count 24 --strict
 * --strict exits nonzero for any architectural diagnostic, but does not change generation.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1]; };
const id = args[0]?.startsWith('station.') ? args[0] : 'station.trading';
const size = opt('size', 'station');
const from = Math.max(1, Number(opt('from', '1')));
const count = Math.max(1, Number(opt('count', '12')));
const strict = args.includes('--strict');
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const { content } = await server.ssrLoadModule('/src/content/index.ts');
  const { generateStation } = await server.ssrLoadModule('/src/sim/shipgen/stationGen.ts');
  const def = content.stations[id];
  if (!def) throw new Error(`unknown station ${id}`);
  const records = [];
  for (let seed = from; seed < from + count; seed++) {
    const started = performance.now();
    const result = generateStation(def, id, size, seed, content.modules, true);
    const { architecture } = result;
    const record = {
      id, size, seed, durationMs: Number((performance.now() - started).toFixed(2)),
      topology: result.topology, attempts: result.attempts, problems: result.problems,
      sourceRequirements: architecture.sourceRequirements,
      generatedRooms: architecture.report.rooms,
      generatedModules: result.template.modules?.length ?? 0,
      architecturalReport: architecture.report,
      recoveredHullProblems: architecture.hullIntegrityProblems,
    };
    records.push(record);
    console.log(`${id} ${size} seed=${seed}: ${record.topology}; rooms=${record.generatedRooms}; ` +
      `independent-access=${architecture.report.independentPublicRoomAccess}/${record.generatedRooms}; ` +
      `V2-hull=${architecture.hullIntegrityProblems.length === 0 ? 'pass' : 'FAIL'}`);
  }
  const output = opt('out', 'tools/shipgen/station-architecture-audit.json');
  writeFileSync(resolve(output), JSON.stringify(records, null, 2));
  if (strict && records.some((r) => r.problems.length || r.recoveredHullProblems.length || r.architecturalReport.issues.length)) process.exitCode = 1;
} finally {
  await server.close();
}
