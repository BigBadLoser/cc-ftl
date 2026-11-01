#!/usr/bin/env node
/**
 * Station generator bench (docs/STATIONGEN2.md section 4).
 *   node tools/shipgen/benchStation.js station.trading --size station --layout stationConcentric,stationWheel --from 1 --count 24 --out dir [--label before] [--sheet]
 *     --count defaults to 24 (60 only for a final comparison). Writes <out>/<label>.json and .md (one column pair per layout; omit --layout for the kind's default mix). --sheet also writes
 *     <label>-<layout>-sheet.png (first 8 seeds) and, with two layouts, <label>-pair.png (column headers = the layout names).
 *   node tools/shipgen/benchStation.js compare a.json b.json [--out x.md]   side-by-side table with deltas (run i against run i)
 *   node tools/shipgen/benchStation.js pair before-sheet.png after-sheet.png [--out x.png] [--titles before,after]
 *   compare refuses results with a different kind, size or seed list unless --allow-mismatch (then the seed intersection is compared).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const mode = ['compare', 'pair'].includes(args[0]) ? args[0] : 'run';
const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--sheet'));

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true } });
try {
  const bench = await server.ssrLoadModule('/tools/shipgen/stationBench.ts');
  const report = await server.ssrLoadModule('/tools/shipgen/stationBenchReport.ts');
  const sheets = await server.ssrLoadModule('/tools/shipgen/stationBenchSheet.ts');
  if (mode === 'compare') {
    const [a, b] = pos.slice(1).map((f) => JSON.parse(readFileSync(f, 'utf8')));
    let md;
    try { md = report.compareMd(a, b, args.includes('--allow-mismatch')); } catch (e) { console.error(String(e.message ?? e)); process.exitCode = 1; throw e; }
    if (opt('out')) writeFileSync(resolve(opt('out')), md); else console.log(md);
  } else if (mode === 'pair') {
    const [a, b] = pos.slice(1).map((f) => readFileSync(f));
    const out = resolve(opt('out', 'pair.png'));
    writeFileSync(out, sheets.pairSheets(a, b, opt('titles', 'before,after').split(',')));
    console.log(out);
  } else {
    const station = pos[0] ?? 'station.trading';
    const o = { station, size: opt('size', 'station'), layouts: opt('layout', 'default').split(','), from: Number(opt('from', 1)), count: Number(opt('count', 24)) };
    const label = opt('label', 'bench');
    const out = resolve(opt('out', 'tools/shipgen/out'));
    mkdirSync(out, { recursive: true });
    const res = bench.runBench(o, label);
    writeFileSync(join(out, `${label}.json`), JSON.stringify(res));
    const md = report.renderMd(res);
    writeFileSync(join(out, `${label}.md`), md);
    console.log(md);
    if (args.includes('--sheet')) {
      const pngs = o.layouts.map((l) => { const p = sheets.layoutSheet(o, l); writeFileSync(join(out, `${label}-${l}-sheet.png`), p); return p; });
      if (pngs.length >= 2) writeFileSync(join(out, `${label}-pair.png`), sheets.pairSheets(pngs[0], pngs[1], o.layouts.slice(0, 2)));
      console.log(`sheets in ${out}`);
    }
  }
} finally {
  await server.close();
}
