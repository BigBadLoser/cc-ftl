import type { Probe } from '../../sim/probe';
import { analyse, Recorder, type SpikeSummary } from './recording';
import { Tally } from './tally';

/** 60 fps frame budget in ms. */
export const BUDGET_MS = 1000 / 60;
/** The label whose end closes a frame (the loop wraps each frame in it). */
export const FRAME_LABEL = 'loop/frame';
/** Counter the loop feeds with the real time between frames, in ms. */
export const INTERVAL_LABEL = 'loop/interval';
const HISTORY = 120;
const MEM_EVERY = 30;

export interface Row {
  label: string;
  calls: number;
  total: number;
  self: number;
  mean: number;
  p95: number;
  max: number;
}

export interface Dist {
  mean: number;
  p95: number;
  max: number;
}

export interface Summary {
  v: 1;
  frames: number;
  budgetMs: number;
  /** Work time per frame (loop/frame); null before the first frame. */
  work: Dist | null;
  /** Real time between frames and the fps it implies; null when the loop does not report it. */
  interval: (Dist & { fps: number }) | null;
  overBudget: number;
  overPct: number;
  bySelf: Row[];
  byTotal: Row[];
  counts: Row[];
  /** Instrumentation time kept out of every span above (observers run inside probe calls), by label. */
  excluded: Row[];
  mem: { heapMB: number; maxMB: number } | null;
  recording: SpikeSummary | null;
}

/**
 * The real probe: a clock, the cumulative tally and the optional recording. Disabled, every call returns at once. It knows
 * nothing about the sim, render or ui; they hold it only as a `Probe`.
 */
export class Profiler implements Probe {
  enabled = false;
  /** Runs just before a frame closes (the installer adds per-frame counters here, e.g. draw calls). */
  beforeFrameEnd: (() => void) | null = null;
  tally: Tally;
  recorder: Recorder | null = null;
  /** Last finished recording's analysis, kept after stop so summary() can show it. */
  lastRecording: SpikeSummary | null = null;
  frames = 0;
  overBudget = 0;
  /** Recent frame work times, newest last (the panel's spike graph). */
  readonly history: number[] = [];
  private mem: { heapMB: number; maxMB: number } | null = null;

  constructor(readonly now: () => number, private readonly heapBytes: () => number | null = () => null, readonly budgetMs = BUDGET_MS) {
    this.tally = new Tally(now);
  }

  begin(label: string): void {
    if (this.enabled) this.tally.begin(label);
  }

  end(label: string): void {
    if (!this.enabled) return;
    if (label === FRAME_LABEL) this.beforeFrameEnd?.();
    this.tally.end(label);
    if (label === FRAME_LABEL) this.endFrame();
  }

  count(label: string, n = 1): void {
    if (this.enabled) this.tally.count(label, n);
  }

  /** Run `fn` as an excluded span (see `Tally.excluded`): its time is reported under `label` in `summary().excluded` and removed from every open span. */
  excluded(label: string, fn: () => void): void {
    if (this.enabled) this.tally.excluded(label, fn);
    else fn();
  }

  private endFrame(): void {
    this.tally.unwind();
    const shares = this.tally.takeFrame();
    const ms = shares.find((s) => s.label === FRAME_LABEL)?.total ?? 0;
    this.frames++;
    if (ms > this.budgetMs) this.overBudget++;
    this.history.push(ms);
    if (this.history.length > HISTORY) this.history.shift();
    this.recorder?.add(this.now(), ms, shares);
    if (this.frames % MEM_EVERY === 1) {
      const b = this.heapBytes();
      if (b !== null) this.mem = { heapMB: b / 1048576, maxMB: Math.max(this.mem?.maxMB ?? 0, b / 1048576) };
    }
  }

  reset(): void {
    this.tally.reset();
    this.frames = 0;
    this.overBudget = 0;
    this.history.length = 0;
    this.mem = null;
    this.lastRecording = null;
    if (this.recorder) this.recorder = new Recorder(this.now());
  }

  get recording(): boolean {
    return this.recorder !== null;
  }

  startRecording(): void {
    this.recorder = new Recorder(this.now());
    this.lastRecording = null;
  }

  /** Stop recording and return its analysis (worst frames and the labels that dominated them). */
  stopRecording(): SpikeSummary | null {
    if (this.recorder) this.lastRecording = analyse(this.recorder.frames, this.budgetMs);
    this.recorder = null;
    return this.lastRecording;
  }

  summary(topN = 12): Summary {
    const row = (s: { label: string; calls: number; total: number; self: number; mean: number; p95: number; max: number }): Row => ({
      label: s.label, calls: s.calls, total: r3(s.total), self: r3(s.self), mean: r3(s.mean), p95: r3(s.p95), max: r3(s.max),
    });
    const all = [...this.tally.stats.values()];
    const timers = all.filter((s) => !s.isCount);
    const work = this.tally.stats.get(FRAME_LABEL);
    const iv = this.tally.stats.get(INTERVAL_LABEL);
    const recording = this.recorder ? analyse(this.recorder.frames, this.budgetMs) : this.lastRecording;
    return {
      v: 1,
      frames: this.frames,
      budgetMs: r3(this.budgetMs),
      work: work ? { mean: r3(work.mean), p95: r3(work.p95), max: r3(work.max) } : null,
      interval: iv ? { mean: r3(iv.mean), p95: r3(iv.p95), max: r3(iv.max), fps: r3(iv.mean > 0 ? 1000 / iv.mean : 0) } : null,
      overBudget: this.overBudget,
      overPct: this.frames ? r3((100 * this.overBudget) / this.frames) : 0,
      bySelf: [...timers].sort((a, b) => b.self - a.self).slice(0, topN).map(row),
      byTotal: [...timers].sort((a, b) => b.total - a.total).slice(0, topN).map(row),
      counts: all.filter((s) => s.isCount && s.label !== INTERVAL_LABEL).sort((a, b) => a.label.localeCompare(b.label)).map(row),
      excluded: [...this.tally.excludedStats.values()].sort((a, b) => a.label.localeCompare(b.label)).map(row),
      mem: this.mem ? { heapMB: r3(this.mem.heapMB), maxMB: r3(this.mem.maxMB) } : null,
      recording,
    };
  }
}

function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
