#!/usr/bin/env node
/**
 * Sim-only profile in Node, no browser.
 *   npm run profile:sim -- [--scenario <name>] [--ticks 5000] [--seed 1] [--rows 25] [--out profile-sim.json] [--empty]
 *                          [--no-metrics] [--stride 25] [--record-decisions file.jsonl] [--dump-board <tick> --board-out board.json]
 * Prints a per-system report (self time sorted) and the crew-AI metrics, and writes the JSON summary. `--scenario list` lists the scenarios.
 * Without `--scenario` it runs the start node (`--empty` skips populating it). `--ticks` defaults to the scenario's own count. The board is dumped when
 * `sim.tick` reaches `--dump-board` (the scenario's setup ticks count: see docs/PROFILING.md). See docs/PROFILING.md.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const scenario = opt('scenario', undefined);
const seed = Number(opt('seed', 1));
const rows = Number(opt('rows', 25));
const out = resolve(opt('out', 'profile-sim.json'));
const dump = opt('dump-board', undefined);
const recordFile = opt('record-decisions', undefined);

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const mod = await server.ssrLoadModule('/tools/profile/simProfile.ts');
  const scen = await server.ssrLoadModule('/tools/profile/scenarios.ts');
  if (scenario === 'list') {
    for (const s of scen.allScenarios()) console.log(`${s.name.padEnd(10)} ${s.ticks} ticks  ${s.description}`);
    process.exit(0);
  }
  const ticks = Number(opt('ticks', scenario ? scen.getScenario(scenario).ticks : 5000));
  const r = mod.profileSim({
    ticks, seed, rows, scenario, populate: !args.includes('--empty'), metrics: !args.includes('--no-metrics'), stride: Number(opt('stride', 25)),
    decisions: !!recordFile, ...(dump !== undefined ? { boardAt: Number(dump) } : {}),
  });
  console.log(`sim profile: scenario=${scenario ?? 'none'} seed=${seed} ticks=${ticks} (setup ended at tick ${r.startTick}) entities=${r.entities}  (frame = one tick here)`);
  console.log(r.report);
  writeFileSync(out, JSON.stringify(r.summary, null, 1));
  console.error(`summary JSON written to ${out}`);
  if (recordFile) {
    const dec = await server.ssrLoadModule('/tools/profile/decisions.ts');
    writeFileSync(resolve(recordFile), dec.serializeDecisions({ format: 'cc-ftl-decisions/1', scenario: scenario ?? 'none', seed, ticks, note: opt('note', undefined) }, r.decisions));
    console.error(`${r.decisions.length} decisions written to ${recordFile}`);
  }
  if (dump !== undefined) {
    if (!r.board) console.error(`board not dumped: sim.tick never equalled ${dump} (run started at tick ${r.startTick}, ended at ${r.tick})`);
    else {
      const file = resolve(opt('board-out', 'board.json'));
      writeFileSync(file, JSON.stringify(r.board));
      console.error(`board at tick ${dump} written to ${file}`);
    }
  }
} finally {
  await server.close();
}
