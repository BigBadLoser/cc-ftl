#!/usr/bin/env node
/**
 * Decision diff: the acceptance tool for crew-AI phases (docs/CREW_AI.md Phase 0).
 *   npm run ai:diff -- --a runA.jsonl --b runB.jsonl [--context 5] [--match id|site]
 *   npm run ai:diff -- --record --scenario <name> [--seed 1] [--ticks N] [--note "rev abc"] --out run.jsonl
 * Record on two revisions (or two flags), then compare. Exit code 0 = identical decisions, 1 = they diverge (the first divergence is printed), 2 = bad input.
 * `--match site` compares job kind and tile instead of job ids, for runs where entity ids may have shifted.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const usage = 'usage: ai:diff --a <file> --b <file> [--context 5] [--match id|site]\n       ai:diff --record --scenario <name> [--seed 1] [--ticks N] [--note text] --out <file>';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
let code = 0;
try {
  const dec = await server.ssrLoadModule('/tools/profile/decisions.ts');
  if (args.includes('--record')) {
    const scenario = opt('scenario', undefined), file = opt('out', undefined);
    if (!scenario || !file) throw new Error(`--record needs --scenario and --out\n${usage}`);
    const { profileSim } = await server.ssrLoadModule('/tools/profile/simProfile.ts');
    const { getScenario } = await server.ssrLoadModule('/tools/profile/scenarios.ts');
    const seed = Number(opt('seed', 1)), ticks = Number(opt('ticks', getScenario(scenario).ticks));
    const r = profileSim({ ticks, seed, rows: 1, populate: getScenario(scenario).populate, scenario, metrics: false, decisions: true });
    writeFileSync(resolve(file), dec.serializeDecisions({ format: 'cc-ftl-decisions/1', scenario, seed, ticks, note: opt('note', undefined) }, r.decisions));
    console.log(`${r.decisions.length} decisions (${scenario}, seed ${seed}, ${ticks} ticks) written to ${file}`);
  } else {
    const fa = opt('a', undefined), fb = opt('b', undefined);
    if (!fa || !fb) throw new Error(usage);
    const a = dec.parseDecisions(readFileSync(resolve(fa), 'utf8'), fa), b = dec.parseDecisions(readFileSync(resolve(fb), 'utf8'), fb);
    for (const k of ['scenario', 'seed', 'ticks']) if (a.header[k] !== b.header[k]) console.log(`warning: ${k} differs (${fa}: ${a.header[k]}, ${fb}: ${b.header[k]}), so a divergence may not mean a behaviour change`);
    if (a.header.note || b.header.note) console.log(`${fa}: ${a.header.note ?? ''}\n${fb}: ${b.header.note ?? ''}`);
    const r = dec.diffDecisions(a.decisions, b.decisions, { context: Number(opt('context', 5)), match: opt('match', 'id') });
    console.log(dec.formatDiff(r, { a: basename(fa), b: basename(fb) }));
    code = r.identical ? 0 : 1;
  }
} catch (e) {
  console.error(e.message);
  code = 2;
} finally {
  await server.close();
}
process.exit(code);
