/** Cumulative per-label statistics since the last reset: calls, total, self, mean, p95 (rolling window), max. */

/** Samples kept per label for p95: a ring of the most recent ones, so p95 describes recent behaviour and memory stays fixed. */
export const WINDOW = 1024;

export class Stat {
  calls = 0;
  /** Sum of durations in ms (timers) or of the counted amounts (counters). */
  total = 0;
  /** Timers only: time spent in this label outside any nested label. */
  self = 0;
  max = 0;
  private readonly ring = new Float64Array(WINDOW);
  private filled = 0;
  private next = 0;
  /** This frame's share, read and cleared by the profiler at frame end. */
  frameTotal = 0;
  frameSelf = 0;
  frameCalls = 0;

  constructor(readonly label: string, readonly isCount: boolean) {}

  add(value: number, self: number): void {
    this.calls++;
    this.total += value;
    this.self += self;
    if (value > this.max) this.max = value;
    this.ring[this.next] = value;
    this.next = (this.next + 1) % WINDOW;
    if (this.filled < WINDOW) this.filled++;
    this.frameTotal += value;
    this.frameSelf += self;
    this.frameCalls++;
  }

  get mean(): number {
    return this.calls ? this.total / this.calls : 0;
  }

  /** Nearest-rank 95th percentile of the rolling window. */
  get p95(): number {
    if (!this.filled) return 0;
    const a = Array.from(this.ring.subarray(0, this.filled)).sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.ceil(a.length * 0.95) - 1)]!;
  }
}

export interface FrameShare {
  label: string;
  total: number;
  self: number;
  calls: number;
  isCount: boolean;
}

export class Tally {
  readonly stats = new Map<string, Stat>();
  private readonly labels: string[] = [];
  private readonly starts: number[] = [];
  private readonly children: number[] = [];
  private depth = 0;
  /** Stats touched since the last `takeFrame`. */
  private touched = new Set<Stat>();

  constructor(private readonly now: () => number) {}

  private stat(label: string, isCount: boolean): Stat {
    let s = this.stats.get(label);
    if (!s) this.stats.set(label, (s = new Stat(label, isCount)));
    return s;
  }

  begin(label: string): void {
    const d = this.depth++;
    this.labels[d] = label;
    this.starts[d] = this.now();
    this.children[d] = 0;
  }

  /** Close `label`. An end that does not match the innermost begin first closes the stale inner ones (a system threw); an unknown end is ignored. */
  end(label: string): void {
    const t = this.now();
    let d = this.depth - 1;
    while (d >= 0 && this.labels[d] !== label) d--;
    if (d < 0) return;
    for (let i = this.depth - 1; i >= d; i--) this.close(i, t);
    this.depth = d;
  }

  private close(i: number, t: number): void {
    const ms = t - this.starts[i]!;
    const s = this.stat(this.labels[i]!, false);
    s.add(ms, ms - this.children[i]!);
    this.touched.add(s);
    if (i > 0) this.children[i - 1]! += ms;
  }

  count(label: string, n = 1): void {
    const s = this.stat(label, true);
    s.add(n, 0);
    this.touched.add(s);
  }

  /** Drop any open spans (a frame that ended with the stack unbalanced). */
  unwind(): void {
    this.depth = 0;
  }

  /** The labels touched this frame, with their frame shares; clears the shares for the next frame. */
  takeFrame(): FrameShare[] {
    const out = [...this.touched].map((s) => ({ label: s.label, total: s.frameTotal, self: s.frameSelf, calls: s.frameCalls, isCount: s.isCount }));
    for (const s of this.touched) {
      s.frameTotal = 0;
      s.frameSelf = 0;
      s.frameCalls = 0;
    }
    this.touched = new Set();
    return out;
  }

  reset(): void {
    this.stats.clear();
    this.touched = new Set();
    this.depth = 0;
  }
}
