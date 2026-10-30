/** A recording: per-frame label totals, for finding spikes. Bounded in frames and in labels kept per frame. */
import type { FrameShare } from './tally';

export interface FrameRec {
  index: number;
  /** ms since the recording started. */
  t: number;
  /** The frame's work time (loop/frame). */
  ms: number;
  /** Top labels by self time (timers), then counters. */
  labels: FrameShare[];
}

export const MAX_FRAMES = 36000;
const KEEP_LABELS = 10;

export class Recorder {
  readonly frames: FrameRec[] = [];
  private seen = 0;

  constructor(readonly startedAt: number) {}

  add(t: number, ms: number, all: FrameShare[]): void {
    const timers = all.filter((l) => !l.isCount).sort((a, b) => b.self - a.self).slice(0, KEEP_LABELS);
    const counts = all.filter((l) => l.isCount);
    this.frames.push({ index: this.seen++, t: t - this.startedAt, ms, labels: [...timers, ...counts] });
    if (this.frames.length > MAX_FRAMES) this.frames.shift();
  }
}

export interface Spike {
  frame: number;
  t: number;
  ms: number;
  /** The labels that took the most self time in that frame. */
  dominant: { label: string; self: number }[];
}

export interface SpikeSummary {
  frames: number;
  seconds: number;
  budgetMs: number;
  overBudget: number;
  worst: Spike[];
  /** Labels that topped the worst frames, most frequent first. */
  culprits: { label: string; frames: number; meanSelf: number }[];
}

/** Flag the worst frames and the labels that dominated them. */
export function analyse(frames: readonly FrameRec[], budgetMs: number, worstN = 5): SpikeSummary {
  const worst = [...frames].sort((a, b) => b.ms - a.ms).slice(0, worstN).map((f): Spike => ({
    frame: f.index,
    t: f.t,
    ms: f.ms,
    dominant: f.labels.filter((l) => !l.isCount).slice(0, 3).map((l) => ({ label: l.label, self: l.self })),
  }));
  const acc = new Map<string, { frames: number; sum: number }>();
  for (const w of worst) {
    const top = w.dominant[0];
    if (!top) continue;
    const a = acc.get(top.label) ?? { frames: 0, sum: 0 };
    a.frames++;
    a.sum += top.self;
    acc.set(top.label, a);
  }
  const culprits = [...acc].map(([label, a]) => ({ label, frames: a.frames, meanSelf: a.sum / a.frames })).sort((a, b) => b.frames - a.frames || b.meanSelf - a.meanSelf);
  const last = frames[frames.length - 1];
  return {
    frames: frames.length,
    seconds: last ? last.t / 1000 : 0,
    budgetMs,
    overBudget: frames.filter((f) => f.ms > budgetMs).length,
    worst,
    culprits,
  };
}
