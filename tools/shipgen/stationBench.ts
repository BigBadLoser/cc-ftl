/**
 * Station generator bench (dev tool; spec: docs/STATIONGEN2.md section 4). Runs one or more layouts over fixed seeds and
 * reports hard checks, structure, circulation, room quality and diversity. Every seed counts: a thrown error or a layout
 * with problems is a failure, kept in the "all seeds" means and left out of the "valid only" means.
 * Reads only GenResult and the template, so it runs unchanged on any branch with the same draw.ts helpers.
 */
import { gen } from './draw';
import { FAIL_ATTEMPTS, makeRun, type Run, type SeedRow } from './stationBenchAgg';
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
      const row: SeedRow = { seed, ok: true, attempts: g.attempts, ms, problems: g.problems, invalid: [], design: [] };
      // generateStation hands back its last template with `problems` once the attempts run out: still invalid.
      for (const p of g.problems) row.invalid.push(`problems: ${p.split(/[:(]/)[0]?.trim().slice(0, 30)}`);
      try {
        row.m = measure(g);
        const h = row.m.hard;
        if (!h.reach) row.invalid.push('unreachable room');
        if (!h.usable) row.invalid.push('unusable module');
        if (!h.docksOk) row.invalid.push('docks');
        if (!h.power) row.invalid.push('power');
        row.design = row.m.design;
      } catch (e) { row.invalid.push('measure error'); row.error = String(e).slice(0, 200); }
      row.ok = row.invalid.length === 0;
      if (!row.ok) row.error ??= row.invalid.join('; ');
      rows.push(row);
    } catch (e) {
      rows.push({ seed, ok: false, error: String(e).slice(0, 300), attempts: FAIL_ATTEMPTS, ms: performance.now() - t0, problems: [], invalid: ['threw'], design: [] });
    }
  }
  return makeRun(layout, spec, rows);
}

export function runBench(o: BenchOpts, label: string): BenchResult {
  return { label, station: o.station, size: o.size, from: o.from, count: o.count, runs: o.layouts.map((l) => runLayout(o, l)) };
}
