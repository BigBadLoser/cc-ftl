/**
 * Decision recording and diffing (docs/CREW_AI.md Phase 0): the acceptance tool for later phases. A recorder watches `AssignmentC` after each step (read-only,
 * no sim hook needed) and logs every change as a decision: crew X took job J (or let go, job 0). Two runs (two revisions, two flags) written as JSONL can be
 * compared with `diffDecisions`, which finds the first point where they differ. A decision's tick is the tick the step ran at (`sim.tick` before it).
 */
import { AssignmentC, CrewC, JobC, NOOP_PROBE, type Probe, type Sim } from '../../src/sim';

/** One assignment change. `job` 0 = released; then `kind` is '-' and `cat`, `x`, `y` are blank. */
export interface Decision {
  t: number;
  c: number;
  job: number;
  kind: string;
  cat: string;
  x: number;
  y: number;
  /** Crew name, for reading only: never compared. */
  name?: string;
}

export interface DecisionHeader {
  format: 'cc-ftl-decisions/1';
  scenario: string;
  seed: number;
  ticks: number;
  /** Free text: git revision, flags. Shown on a mismatch, never compared. */
  note?: string;
}

export class DecisionRecorder {
  readonly decisions: Decision[] = [];
  private held = new Map<number, number>();

  /**
   * A probe to step the sim with (`sim.step(rec.probe(sim))`), passing the timing probe through as `inner`. An assignment can be made and dropped inside one step
   * (decide hands out a one-tick job and `sim/work` finishes it; a fight system releases what decide just gave), so the assignments are captured as every system
   * begins, i.e. after the previous one, and `observe` after the step sees what the last system changed. The assigners are commands, decide, rescue and
   * `resumeAfter` (inside work, which re-assigns a job the crew member had already reserved), so nothing is made and dropped between two captures except by one
   * system doing both. Costs a scan of the assigned crew per system, so it is only on when recording. Read-only: no events, no sim code.
   */
  probe(sim: Sim, inner: Probe = NOOP_PROBE): Probe {
    return {
      begin: (label) => {
        if (label !== 'sim/tick') this.capture(sim, sim.tick); // before every system: sees what the previous one did
        inner.begin(label);
      },
      end: (label) => inner.end(label),
      count: (label, n) => inner.count(label, n),
    };
  }

  /** Call after each `sim.step()`, whether or not the step ran with `probe`. */
  observe(sim: Sim): void {
    this.capture(sim, sim.tick - 1);
  }

  /** Log what changed since the last capture, as decisions of tick `t`. */
  private capture(sim: Sim, t: number): void {
    const now = new Map<number, number>();
    for (const c of sim.world.query(CrewC, AssignmentC)) now.set(c, sim.world.get(c, AssignmentC)?.jobId ?? 0);
    const changed: Decision[] = [];
    for (const [c, job] of now) if (this.held.get(c) !== job) changed.push(this.make(sim, t, c, job));
    for (const c of this.held.keys()) if (!now.has(c)) changed.push(this.make(sim, t, c, 0));
    this.held = now;
    changed.sort((a, b) => a.c - b.c || a.job - b.job);
    this.decisions.push(...changed);
  }

  private make(sim: Sim, t: number, c: number, job: number): Decision {
    const j = job ? sim.world.get(job, JobC) : undefined;
    const name = sim.world.get(c, CrewC)?.name;
    return { t, c, job, kind: j?.kind ?? '-', cat: j?.category ?? '', x: j?.x ?? 0, y: j?.y ?? 0, ...(name ? { name } : {}) };
  }
}

export function serializeDecisions(header: DecisionHeader, decisions: readonly Decision[]): string {
  return [JSON.stringify(header), ...decisions.map((d) => JSON.stringify(d))].join('\n') + '\n';
}

/** Parse a decisions file. Throws with the line number on a malformed line. */
export function parseDecisions(text: string, label = 'input'): { header: DecisionHeader; decisions: Decision[] } {
  const lines = text.split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) throw new Error(`${label}: empty file`);
  let header: DecisionHeader;
  try {
    header = JSON.parse(lines[0] as string) as DecisionHeader;
  } catch (e) {
    throw new Error(`${label}: line 1 is not JSON (${(e as Error).message})`);
  }
  if (header.format !== 'cc-ftl-decisions/1') throw new Error(`${label}: line 1 is not a cc-ftl-decisions/1 header`);
  const decisions = lines.slice(1).map((l, i) => {
    let d: Decision;
    try {
      d = JSON.parse(l) as Decision;
    } catch (e) {
      throw new Error(`${label}: line ${i + 2} is not JSON (${(e as Error).message})`);
    }
    if (typeof d.t !== 'number' || typeof d.c !== 'number' || typeof d.job !== 'number') throw new Error(`${label}: line ${i + 2} is not a decision (needs t, c, job)`);
    return d;
  });
  return { header, decisions };
}

export interface DiffOptions {
  /** Lines of context before and after the divergence. */
  context?: number;
  /** 'id' compares job ids (same run shape); 'site' compares kind and tile instead, for runs where entity ids may have shifted. */
  match?: 'id' | 'site';
}

export interface Divergence {
  /** Index into the aligned (per-tick sorted) event lists. */
  index: number;
  tick: number;
  /** What differs: 'job' (same crew and tick, other job), 'onlyA' / 'onlyB' (one run decided, the other did not at that tick), 'other'. */
  reason: 'job' | 'onlyA' | 'onlyB' | 'other';
  a: Decision | undefined;
  b: Decision | undefined;
  before: Decision[];
  /** What each run decided at the divergence tick that the other did not (the same decision in both runs is left out). */
  tickA: Decision[];
  tickB: Decision[];
  /** How many decisions both runs made at that tick. */
  tickShared: number;
  afterA: Decision[];
  afterB: Decision[];
}

export interface DiffResult {
  identical: boolean;
  countA: number;
  countB: number;
  divergence?: Divergence;
}

const sameKey = (a: Decision, b: Decision, match: 'id' | 'site'): boolean =>
  a.t === b.t && a.c === b.c && (match === 'id' ? a.job === b.job : a.kind === b.kind && a.x === b.x && a.y === b.y);

/**
 * Normalise the order within a tick (crew id, then the compared key) so the comparison does not depend on how a run iterates. With
 * `match: 'site'` the job id plays no part, so two runs whose ids are numbered differently still line up.
 */
const normalise = (ds: readonly Decision[], match: 'id' | 'site'): Decision[] =>
  [...ds].sort((p, q) => p.t - q.t || p.c - q.c || (match === 'id'
    ? p.job - q.job
    : (p.kind < q.kind ? -1 : p.kind > q.kind ? 1 : 0) || p.y - q.y || p.x - q.x));

/** Find the first divergence between two decision lists. */
export function diffDecisions(aIn: readonly Decision[], bIn: readonly Decision[], opts: DiffOptions = {}): DiffResult {
  const ctx = opts.context ?? 5, match = opts.match ?? 'id';
  const a = normalise(aIn, match), b = normalise(bIn, match);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i], y = b[i];
    if (x && y && sameKey(x, y, match)) continue;
    const tick = Math.min(x?.t ?? Infinity, y?.t ?? Infinity);
    const atTick = (ds: Decision[]): Decision[] => ds.filter((d) => d.t === tick);
    const [ta, tb] = [atTick(a), atTick(b)];
    const keyOf = (d: Decision): string => (match === 'id' ? `${d.c}|${d.job}` : `${d.c}|${d.kind}|${d.x}|${d.y}`);
    const [ka, kb] = [new Set(ta.map(keyOf)), new Set(tb.map(keyOf))];
    const [onlyA, onlyB] = [ta.filter((d) => !kb.has(keyOf(d))), tb.filter((d) => !ka.has(keyOf(d)))];
    let reason: Divergence['reason'] = 'other';
    if (x && y && x.t === y.t && x.c === y.c) reason = 'job';
    else if (x && (!y || x.t < y.t || (x.t === y.t && x.c < y.c))) reason = 'onlyA';
    else if (y) reason = 'onlyB';
    return {
      identical: false, countA: a.length, countB: b.length,
      divergence: {
        index: i, tick, reason, a: x, b: y,
        before: a.slice(Math.max(0, i - ctx), i), tickA: onlyA, tickB: onlyB, tickShared: ta.length - onlyA.length, afterA: a.slice(i + 1, i + 1 + ctx), afterB: b.slice(i + 1, i + 1 + ctx),
      },
    };
  }
  return { identical: true, countA: a.length, countB: b.length };
}

const fmt = (d: Decision | undefined): string =>
  d ? `t=${String(d.t).padStart(5)}  crew ${String(d.c).padStart(4)}${d.name ? ` (${d.name})` : ''}  ${d.job ? `job ${d.job} ${d.kind}/${d.cat} @${d.x},${d.y}` : 'released'}` : '(nothing)';

/** A readable report of a diff: the verdict, then, when they differ, the first divergence with its context. */
export function formatDiff(r: DiffResult, labels: { a: string; b: string } = { a: 'A', b: 'B' }): string {
  if (r.identical) return `IDENTICAL: ${r.countA} decisions in both ${labels.a} and ${labels.b}.`;
  const d = r.divergence as Divergence;
  const why = {
    job: 'same crew, same tick, different job',
    onlyA: `${labels.a} decided something ${labels.b} did not at that point`,
    onlyB: `${labels.b} decided something ${labels.a} did not at that point`,
    other: 'different decisions',
  }[d.reason];
  const out = [
    `DIVERGED at tick ${d.tick} (event #${d.index} of ${r.countA} in ${labels.a}, ${r.countB} in ${labels.b}): ${why}`,
    '',
    'same until here:',
    ...(d.before.length ? d.before.map((x) => `    ${fmt(x)}`) : ['    (nothing: they differ from the first decision)']),
    '',
    `  ${labels.a}: ${fmt(d.a)}`,
    `  ${labels.b}: ${fmt(d.b)}`,
    '',
    `at tick ${d.tick} both made ${d.tickShared} identical decisions; only in one run:`,
    `  only in ${labels.a}:`, ...(d.tickA.length ? d.tickA.slice(0, 15).map((x) => `    ${fmt(x)}`) : ['    (none)']), ...(d.tickA.length > 15 ? [`    ... ${d.tickA.length - 15} more`] : []),
    `  only in ${labels.b}:`, ...(d.tickB.length ? d.tickB.slice(0, 15).map((x) => `    ${fmt(x)}`) : ['    (none)']), ...(d.tickB.length > 15 ? [`    ... ${d.tickB.length - 15} more`] : []),
    '',
    `next in ${labels.a}:`, ...(d.afterA.length ? d.afterA.map((x) => `    ${fmt(x)}`) : ['    (end)']),
    `next in ${labels.b}:`, ...(d.afterB.length ? d.afterB.map((x) => `    ${fmt(x)}`) : ['    (end)']),
  ];
  return out.join('\n');
}
