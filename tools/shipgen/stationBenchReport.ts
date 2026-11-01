/** Station bench reports: the compact markdown table and the validated side-by-side comparison. */
import { fmt, keysOf, makeRun, metricRows, type Run } from './stationBenchAgg';
import type { BenchResult } from './stationBench';

const NOTES = [
  'Structural averages (voids, slivers, aspect, protrusion, circulation, expectation, diversity) cover seeds that produced a template; generations that threw have no template, so they are excluded from those averages and counted in the invalid rate. n for each is "seeds (with metrics)".',
  'Invalid = functional failure (exception, generator problems, unreachable room, unusable module, docks, power, station rules); only invalid counts toward validity. Design violations (slivers, non-rectangular machine room) are reported separately. Cargo rectangularity is info only.',
  'Void = space enclosed by the hull, as a share of floor. Deliberate only if the region has >= 40 tiles, area/bbox >= 0.5 and is bounded >= 90% by corridor/hull wall (a `negativeSpace` mask claim must pass the same test; rejected claims are counted). Everything else is unintended.',
  'Outline = per-bin outer radius (48 bins around the centre; outermost non-space tile; airlocks and dock rooms excluded). Spread = (p90 - p10) / median; roughness = mean |r[i] - r[i+1]| over adjacent bins in tiles; offenders = role owning the outermost tile in bins > 1.5 tiles above the median. The old protrusion share stays in the JSON only.',
  'Diversity: 16x16 role-signature Hamming distance, 16x16 structure-only distance (floor/corridor/wall/space), and structural parameters (from the topology string, or the result\'s `params`): distinct combinations and entropy.',
  'Ring frontage: share of the ring corridor\'s walls (outboard, inboard) with a room behind them rather than space; walls onto spokes are left out. Flow (on the room graph, rooms joined by doors): public rooms (shop, mess, medbay, office, dock) every airlock reaches through corridors and courts alone; public rooms still joined once private rooms are taken out; controlled departments (secure core: reactor, shields, AI core; defence: gun bays) entered from circulation by more than one room (extra entrances = bypasses). Service doors are not checked (none designated yet).',
];

/** Compact markdown: one column pair per layout (all seeds, valid only). */
export function renderMd(r: BenchResult): string {
  const aggs = r.runs.flatMap((x) => [x.all, x.valid]);
  const keys = keysOf(...aggs);
  const cols = r.runs.flatMap((x) => [{ h: `${x.layout} all`, m: metricRows(x.all, keys) }, { h: `${x.layout} valid`, m: metricRows(x.valid, keys) }]);
  const head = `| metric | ${cols.map((c) => c.h).join(' | ')} |`;
  const body = (cols[0]?.m ?? []).map(([k], i) => `| ${k} | ${cols.map((c) => fmt(c.m[i]?.[1] ?? NaN)).join(' | ')} |`);
  const fails = r.runs.flatMap((x) => x.rows.filter((s) => !s.ok).slice(0, 5).map((s) => `- ${x.layout} seed ${s.seed}: ${s.error ?? 'failed'}`));
  const flow = r.runs.flatMap((x) => x.rows.filter((s) => s.m?.flow?.violations.length).map((s) => `- ${x.layout} seed ${s.seed}: ${summarise(s.m?.flow?.violations ?? [])}`));
  return [`# ${r.label}: ${r.station} ${r.size}, seeds ${r.from}-${r.from + r.count - 1}`, '', ...NOTES.map((n) => `> ${n}`), '', head, `|${' --- |'.repeat(cols.length + 1)}`, ...body, ...(fails.length ? ['', 'First invalid seeds:', ...fails] : []), ...(flow.length ? ['', 'Flow violations by seed:', ...flow] : [])].join('\n') + '\n';
}

/** Violations counted by kind ("controlled reactor+shields x4: 4 entrances" keeps its text; repeats are counted). */
function summarise(vs: string[]): string {
  const n = new Map<string, number>();
  for (const v of vs) { const k = v.replace(/#\d+/, ''); n.set(k, (n.get(k) ?? 0) + 1); }
  return [...n.entries()].map(([k, c]) => (c > 1 ? `${k} (x${c})` : k)).join('; ');
}

const seedsOf = (run: Run): number[] => run.rows.map((s) => s.seed);

/**
 * Side-by-side table of two bench results (run i of a against run i of b), with deltas. Refuses when kind, size or seed
 * lists differ; with `allowMismatch` compares the seed intersection and says so in the header.
 */
export function compareMd(a: BenchResult, b: BenchResult, allowMismatch = false): string {
  const problems: string[] = [];
  if (a.station !== b.station) problems.push(`kind: ${a.station} vs ${b.station}`);
  if (a.size !== b.size) problems.push(`size: ${a.size} vs ${b.size}`);
  if (a.runs.length !== b.runs.length) problems.push(`layout columns: ${a.runs.length} vs ${b.runs.length}`);
  a.runs.forEach((ra, i) => {
    const rb = b.runs[i];
    if (rb && seedsOf(ra).join() !== seedsOf(rb).join()) problems.push(`seeds of column ${i + 1}: ${ra.rows.length} (${ra.layout}) vs ${rb.rows.length} (${rb.layout}), lists differ`);
  });
  if (problems.length && !allowMismatch) throw new Error(`compare refused, results are not comparable (use --allow-mismatch to compare the seed intersection): ${problems.join('; ')}`);
  const out = [`# ${a.label} vs ${b.label}`, '', `${a.label}: ${a.station} ${a.size}, layouts ${a.runs.map((r) => r.spec).join(', ')}`, `${b.label}: ${b.station} ${b.size}, layouts ${b.runs.map((r) => r.spec).join(', ')}`];
  if (problems.length) out.push('', `WARNING mismatch allowed (${problems.join('; ')}): only the seed intersection is compared.`);
  out.push('');
  a.runs.forEach((ra0, i) => {
    const rb0 = b.runs[i];
    if (!rb0) return;
    const common = new Set(seedsOf(ra0).filter((s) => seedsOf(rb0).includes(s)));
    const [ra, rb] = problems.length ? [makeRun(ra0.layout, ra0.spec, ra0.rows.filter((s) => common.has(s.seed))), makeRun(rb0.layout, rb0.spec, rb0.rows.filter((s) => common.has(s.seed)))] : [ra0, rb0];
    const keys = keysOf(ra.all, rb.all, ra.valid, rb.valid);
    const [aa, av, ba, bv] = [metricRows(ra.all, keys), metricRows(ra.valid, keys), metricRows(rb.all, keys), metricRows(rb.valid, keys)];
    const d = (x: number | string | undefined, y: number | string | undefined): string =>
      typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y) ? `${y - x >= 0 ? '+' : ''}${fmt(y - x)}` : '';
    out.push(`## ${ra.layout} (${a.label}) vs ${rb.layout} (${b.label}), ${common.size} seeds`, '', `| metric | ${a.label} all | ${b.label} all | delta | ${a.label} valid | ${b.label} valid | delta |`, '| --- | --- | --- | --- | --- | --- | --- |');
    aa.forEach(([k, v], j) => out.push(`| ${k} | ${fmt(v)} | ${fmt(ba[j]?.[1] ?? NaN)} | ${d(v, ba[j]?.[1])} | ${fmt(av[j]?.[1] ?? NaN)} | ${fmt(bv[j]?.[1] ?? NaN)} | ${d(av[j]?.[1], bv[j]?.[1])} |`));
    out.push('');
  });
  return out.join('\n');
}
