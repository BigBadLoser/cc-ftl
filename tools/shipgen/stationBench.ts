/**
 * Station generator bench (dev tool; spec: docs/STATIONGEN2.md section 4). Runs one or more layouts over fixed seeds and
 * reports hard checks, structure, circulation, room quality and diversity. Every seed counts: a thrown error or a layout
 * with problems is a failure, kept in the "all seeds" means and left out of the "valid only" means.
 * Reads only GenResult and the template, so it runs unchanged on any branch with the same draw.ts helpers.
 */
import { gen } from './draw';
import { FAIL_ATTEMPTS, fmt, makeRun, metricRows, reasonsOf, rolesOf, type Run, type SeedRow } from './stationBenchAgg';
import { measure } from './stationBenchMetrics';

export interface BenchOpts { station: string; size: string; layouts: string[]; from: number; count: number }
export interface BenchResult { label: string; station: string; size: string; from: number; count: number; runs: Run[] }

export const specOf = (station: string, size: string, layout: string): string =>
  `${station.startsWith('station.') ? station : `station.${station}`}:${size}${layout && layout !== 'default' ? `@${layout}` : ''}`;

export function runLayout(o: BenchOpts, layout: string): Run {
  const spec = specOf(o.station, o.size, layout);
  const rows: SeedRow[] = [];
  for (let seed = o.from; seed < o.from + o.count; seed++) {
    const t0 = performance.now();
    try {
      const g = gen(spec, seed, 0);
      const ms = performance.now() - t0;
      const row: SeedRow = { seed, ok: true, attempts: g.attempts, ms, problems: g.problems, reasons: [] };
      // generateStation hands back its last template with `problems` once the attempts run out: still a failure.
      for (const p of g.problems) row.reasons.push(`problems: ${p.split(/[:(]/)[0]?.trim().slice(0, 30)}`);
      try {
        row.m = measure(g);
        const h = row.m.hard;
        if (!h.reach) row.reasons.push('unreachable room');
        if (!h.usable) row.reasons.push('unusable module');
        if (!h.docksOk) row.reasons.push('docks');
        if (!h.power) row.reasons.push('power');
        for (const role of new Set(h.badRects.map((b) => b.split('#')[0]))) row.reasons.push(`non-rect machine room: ${role}`);
      } catch (e) { row.reasons.push('measure error'); row.error = String(e).slice(0, 200); }
      row.ok = row.reasons.length === 0;
      if (!row.ok) row.error ??= row.reasons.join('; ');
      rows.push(row);
    } catch (e) {
      rows.push({ seed, ok: false, error: String(e).slice(0, 300), attempts: FAIL_ATTEMPTS, ms: performance.now() - t0, problems: [], reasons: ['threw'] });
    }
  }
  return makeRun(layout, spec, rows);
}

export function runBench(o: BenchOpts, label: string): BenchResult {
  return { label, station: o.station, size: o.size, from: o.from, count: o.count, runs: o.layouts.map((l) => runLayout(o, l)) };
}

/** Compact markdown: one column per layout, all seeds and valid only. */
export function renderMd(r: BenchResult): string {
  const aggs = r.runs.flatMap((x) => [x.all, x.valid]);
  const roles = rolesOf(...aggs), why = reasonsOf(...aggs);
  const cols = r.runs.flatMap((x) => [{ h: `${x.layout} all`, m: metricRows(x.all, roles, why) }, { h: `${x.layout} valid`, m: metricRows(x.valid, roles, why) }]);
  const head = `| metric | ${cols.map((c) => c.h).join(' | ')} |`;
  const body = (cols[0]?.m ?? []).map(([k], i) => `| ${k} | ${cols.map((c) => fmt(c.m[i]?.[1] ?? NaN)).join(' | ')} |`);
  const fails = r.runs.flatMap((x) => x.rows.filter((s) => !s.ok).slice(0, 5).map((s) => `- ${x.layout} seed ${s.seed}: ${s.error ?? 'failed'}`));
  return [`# ${r.label}: ${r.station} ${r.size}, seeds ${r.from}-${r.from + r.count - 1}`, '', head, `|${' --- |'.repeat(cols.length + 1)}`, ...body, ...(fails.length ? ['', 'First failures:', ...fails] : [])].join('\n') + '\n';
}

/** Side-by-side table of two bench results (run i of a against run i of b), with deltas. */
export function compareMd(a: BenchResult, b: BenchResult): string {
  const out = [`# ${a.label} vs ${b.label}`, ''];
  a.runs.forEach((ra, i) => {
    const rb = b.runs[i];
    if (!rb) return;
    const roles = rolesOf(ra.all, ra.valid, rb.all, rb.valid);
    const why = reasonsOf(ra.all, rb.all);
    const m = (x: Run['all']): ReturnType<typeof metricRows> => metricRows(x, roles, why);
    const [aa, av, ba, bv] = [m(ra.all), m(ra.valid), m(rb.all), m(rb.valid)];
    const d = (x: number | string | undefined, y: number | string | undefined): string =>
      typeof x === 'number' && typeof y === 'number' && !Number.isNaN(x) && !Number.isNaN(y) ? `${y - x >= 0 ? '+' : ''}${fmt(y - x)}` : '';
    out.push(`## ${ra.layout} (${a.label}) vs ${rb.layout} (${b.label})`, '', `| metric | ${a.label} all | ${b.label} all | delta | ${a.label} valid | ${b.label} valid | delta |`, '| --- | --- | --- | --- | --- | --- | --- |');
    aa.forEach(([k, v], j) => out.push(`| ${k} | ${fmt(v)} | ${fmt(ba[j]?.[1] ?? NaN)} | ${d(v, ba[j]?.[1])} | ${fmt(av[j]?.[1] ?? NaN)} | ${fmt(bv[j]?.[1] ?? NaN)} | ${d(av[j]?.[1], bv[j]?.[1])} |`));
    out.push('');
  });
  return out.join('\n');
}
