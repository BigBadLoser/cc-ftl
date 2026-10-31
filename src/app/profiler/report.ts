import type { Row, Summary } from './profiler';

const f = (v: number, d = 2): string => v.toFixed(d);

function table(rows: Row[], countRows = false): string[] {
  const head = countRows
    ? ['label', 'calls', 'total', 'mean', 'p95', 'max']
    : ['label', 'calls', 'self ms', 'total ms', 'mean', 'p95', 'max'];
  const body = rows.map((r) => (countRows
    ? [r.label, String(r.calls), f(r.total, 0), f(r.mean), f(r.p95), f(r.max)]
    : [r.label, String(r.calls), f(r.self), f(r.total), f(r.mean, 3), f(r.p95, 3), f(r.max, 3)]));
  const w = head.map((h, i) => Math.max(h.length, ...body.map((b) => b[i]!.length)));
  const line = (cells: string[]): string => cells.map((c, i) => (i === 0 ? c.padEnd(w[i]!) : c.padStart(w[i]!))).join('  ').trimEnd();
  return [line(head), ...body.map(line)];
}

/** A short plain-text report, sorted by self time. Meant to be read in an agent's context: no dumps. */
export function formatReport(s: Summary, rows = 20): string {
  const out: string[] = [];
  const w = s.work;
  out.push(`frames ${s.frames}  over ${f(s.budgetMs)}ms budget: ${s.overBudget} (${f(s.overPct, 1)}%)`);
  if (w) out.push(`work/frame  mean ${f(w.mean)}  p95 ${f(w.p95)}  max ${f(w.max)} ms`);
  if (s.interval) out.push(`interval    mean ${f(s.interval.mean)}  p95 ${f(s.interval.p95)}  max ${f(s.interval.max)} ms  (${f(s.interval.fps, 1)} fps)`);
  if (s.mem) out.push(`heap ${f(s.mem.heapMB, 1)} MB (max ${f(s.mem.maxMB, 1)})`);
  out.push('', 'timers by self time (ms; self excludes nested labels)', ...table(s.bySelf.slice(0, rows)));
  if (s.excluded?.length) {
    out.push('', 'instrument time (observers; excluded from every span above, not in the frame work)');
    for (const r of s.excluded) out.push(`  ${r.label}  ${r.calls} calls  ${f(r.total)} ms total  mean ${f(r.mean, 3)}  p95 ${f(r.p95, 3)}  max ${f(r.max, 3)}`);
  }
  if (s.counts.length) out.push('', 'counters (per call/frame)', ...table(s.counts, true));
  const rec = s.recording;
  if (rec) {
    out.push('', `recording ${rec.frames} frames, ${f(rec.seconds, 1)} s, ${rec.overBudget} over budget; worst frames:`);
    for (const x of rec.worst) out.push(`  #${x.frame} t=${f(x.t / 1000, 2)}s ${f(x.ms)}ms  ${x.dominant.map((d) => `${d.label} ${f(d.self)}`).join(', ')}`);
    if (rec.culprits.length) out.push(`  culprits: ${rec.culprits.map((c) => `${c.label} x${c.frames} (avg ${f(c.meanSelf)}ms)`).join(', ')}`);
  }
  return out.join('\n');
}
