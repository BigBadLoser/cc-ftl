/** Station bench: per-seed rows, aggregates (all seeds and valid only) and the metric table both reports share. */
import type { Metrics } from './stationBenchMetrics';

export interface SeedRow {
  seed: number; ok: boolean; error?: string; reasons: string[]; attempts: number; ms: number; problems: string[]; m?: Metrics;
}
export interface Agg {
  n: number; withMetrics: number; validRate: number; attempts: number; msMedian: number; msP95: number;
  voidUnintended: number; voidDeliberate: number; voidMethod: string; sliverShare: number; aspectP90: number; fillMean: number; protrusion: number;
  quality: number; expectAll: number; expectByRole: Record<string, number>; depthByRole: Record<string, number>;
  viaQuarters: number; reach: number; usable: number; docks: number; power: number; rects: number; cargoRect: number;
  diversity: number; diversityStruct: number; faces: Record<string, number>;
  /** Failure rate and seeds per failure reason. */
  failRate: number; reasons: Record<string, number>;
}
export interface Run { layout: string; spec: string; rows: SeedRow[]; all: Agg; valid: Agg }

/** A thrown generation (no result) counts as this many attempts: the generator's retry budget (GEN_ATTEMPTS). */
export const FAIL_ATTEMPTS = 24;

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
export const pct = (xs: number[], p: number): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[Math.min(s.length - 1, Math.floor(p * s.length))] as number) : 0;
};
const share = (xs: boolean[]): number => (xs.length ? xs.filter(Boolean).length / xs.length : 0);

export function aggregate(rows: SeedRow[]): Agg {
  const ms = rows.map((r) => r.m).filter((m): m is Metrics => !!m);
  const roles = new Set(ms.flatMap((m) => Object.keys(m.expect)));
  const sum = (f: (m: Metrics) => number): number => ms.reduce((t, m) => t + f(m), 0);
  const expectByRole: Record<string, number> = {};
  const depthByRole: Record<string, number> = {};
  for (const r of [...roles].sort()) {
    const tot = sum((m) => m.expect[r]?.[1] ?? 0);
    expectByRole[r] = tot ? sum((m) => m.expect[r]?.[0] ?? 0) / tot : NaN;
    const d = ms.flatMap((m) => m.depth[r] ?? []);
    if (d.length) depthByRole[r] = mean(d);
  }
  const totalRooms = sum((m) => m.rooms);
  const hamming = (sigs: string[]): number => {
    const pairs: number[] = [];
    sigs.forEach((a, i) => sigs.slice(i + 1).forEach((b) => { let d = 0; for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) d++; pairs.push(d / a.length); }));
    return mean(pairs);
  };
  const reasons: Record<string, number> = {};
  for (const r of rows) for (const x of new Set(r.reasons)) reasons[x] = (reasons[x] ?? 0) + 1;
  const faces: Record<string, number> = { N: 0, S: 0, E: 0, W: 0 };
  for (const m of ms) for (const k of Object.keys(faces)) faces[k] = (faces[k] as number) + m.faces[k as 'N'];
  return {
    n: rows.length, withMetrics: ms.length,
    validRate: share(rows.map((r) => r.ok)),
    attempts: mean(rows.map((r) => r.attempts)),
    msMedian: pct(rows.map((r) => r.ms), 0.5), msP95: pct(rows.map((r) => r.ms), 0.95),
    voidUnintended: mean(ms.map((m) => m.voidUnintended)), voidDeliberate: mean(ms.map((m) => m.voidDeliberate)),
    voidMethod: [...new Set(ms.map((m) => m.voidMethod))].join('+') || '-',
    sliverShare: totalRooms ? sum((m) => m.slivers) / totalRooms : 0,
    aspectP90: pct(ms.flatMap((m) => m.aspects), 0.9),
    fillMean: mean(ms.flatMap((m) => m.fills)),
    protrusion: mean(ms.map((m) => m.protrusion)),
    quality: mean(ms.flatMap((m) => m.quality)),
    expectAll: totalRooms ? sum((m) => Object.values(m.expect).reduce((t, e) => t + e[0], 0)) / totalRooms : 0,
    expectByRole, depthByRole,
    viaQuarters: mean(ms.map((m) => m.viaQuarters)),
    reach: share(ms.map((m) => m.hard.reach)), usable: share(ms.map((m) => m.hard.usable)),
    docks: mean(ms.map((m) => m.hard.docks)), power: share(ms.map((m) => m.hard.power)), rects: share(ms.map((m) => m.hard.rects)), cargoRect: mean(ms.map((m) => m.cargoRect).filter((v) => !Number.isNaN(v))),
    diversity: hamming(ms.map((m) => m.sig)), diversityStruct: hamming(ms.map((m) => m.sigS)), faces,
    failRate: rows.length ? rows.filter((r) => !r.ok).length / rows.length : 0, reasons,
  };
}

export const makeRun = (layout: string, spec: string, rows: SeedRow[]): Run => ({
  layout, spec, rows, all: aggregate(rows), valid: aggregate(rows.filter((r) => r.ok)),
});

/** The shared table: [label, value, format]. Role rows are appended for every role in either side. */
export function metricRows(a: Agg, roles: string[], reasons: string[] = Object.keys(a.reasons).sort()): [string, number | string][] {
  const out: [string, number | string][] = [
    ['seeds (with metrics)', `${a.n} (${a.withMetrics})`], ['validity rate', a.validRate], ['failure rate', a.failRate],
    ...reasons.map((r): [string, number] => [`fail: ${r}`, a.reasons[r] ?? 0]), ['attempts mean', a.attempts],
    ['ms median', a.msMedian], ['ms p95', a.msP95],
    ['hard: all rooms reachable', a.reach], ['hard: modules usable', a.usable], ['hard: power ok', a.power], ['hard: rect rooms rectangular', a.rects], ['info: cargo rooms rectangular', a.cargoRect], ['docks mean', a.docks],
    ['void unintended (share of floor)', a.voidUnintended], ['void deliberate (share of floor)', a.voidDeliberate], ['void classified by', a.voidMethod], ['sliver share of rooms', a.sliverShare], ['room aspect p90', a.aspectP90], ['room fill mean', a.fillMean], ['protrusion share', a.protrusion],
    ['rooms only via quarters (mean)', a.viaQuarters], ['roomQuality mean', a.quality], ['expectation pass (all roles)', a.expectAll],
    ...roles.map((r): [string, number] => [`expect pass: ${r}`, a.expectByRole[r] ?? NaN]),
    ...roles.map((r): [string, number] => [`walk depth: ${r}`, a.depthByRole[r] ?? NaN]),
    ['diversity: roles (mean Hamming, 16x16)', a.diversity], ['diversity: structure only (16x16)', a.diversityStruct],
    ['dock faces N/S/E/W', `${a.faces.N}/${a.faces.S}/${a.faces.E}/${a.faces.W}`],
  ];
  return a.n === 0 ? out.map(([k, v]): [string, number | string] => [k, k.startsWith('seeds') ? v : typeof v === 'string' ? '-' : NaN]) : out;
}

export const rolesOf = (...as: Agg[]): string[] => [...new Set(as.flatMap((a) => Object.keys(a.expectByRole)))].sort();

export const fmt = (v: number | string): string => (typeof v === 'string' ? v : Number.isNaN(v) ? '-' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(3));

export const reasonsOf = (...as: Agg[]): string[] => [...new Set(as.flatMap((a) => Object.keys(a.reasons)))].sort();
