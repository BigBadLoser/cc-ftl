import { checkCondition } from './conditions';
import type { LessonPrefs } from './prefs';
import type { LessonCtx, LessonDef, LessonFrame, LessonSignal, StepDef } from './types';

export type Speed = 0 | 1 | 2 | 3;

/** The game's time controls, the same path the pause key takes (`api.setSpeed`). */
export interface LessonClock {
  speed(): Speed;
  setSpeed(speed: Speed): void;
}

/** The open lesson as the coach mark shows it. */
export interface LessonView {
  lesson: LessonDef;
  index: number;
  step: StepDef;
}

/** Real ms between one lesson closing and the next opening. */
export const LESSON_COOLDOWN_MS = 1500;

/**
 * The lessons engine: plain TS, no DOM. Feed it `update(ctx, now, signals)` (the host does, every frame); it queues triggered lessons,
 * opens one at a time when nothing urgent is up and the cooldown has passed, advances "do" steps on their condition and pauses the game
 * while a lesson is open. Lessons are data (`LessonDef`); conditions and targets are registries (conditions.ts, targets.ts).
 */
export class LessonEngine {
  /** Triggered lessons in order, each with the time (ms) it may open: trigger time plus its `delay`. */
  private queue: { def: LessonDef; at: number }[] = [];
  private open: { def: LessonDef; index: number; held: Speed } | null = null;
  private cooldownUntil = -Infinity;
  private now = 0;
  private frame: LessonFrame | null = null;
  private subs = new Set<(v: LessonView | null) => void>();
  /** Something else holds the pause now (the Esc menu, the bug report, a decision): the engine never un-pauses behind it. */
  private busy = false;
  /**
   * The speed a lesson closed under a busy screen would have restored. The pause owner that closes last restores: once nothing is busy
   * and no lesson is open, this goes back on (if the game is still paused); a lesson opening first takes it over as its own.
   */
  private deferred: Speed | null = null;

  constructor(
    private readonly defs: readonly LessonDef[],
    private readonly clock: LessonClock,
    private readonly prefs: LessonPrefs,
    private readonly cooldownMs = LESSON_COOLDOWN_MS,
  ) {}

  get current(): LessonView | null {
    const o = this.open;
    const step = o?.def.steps[o.index];
    return o && step ? { lesson: o.def, index: o.index, step } : null;
  }

  subscribe(fn: (v: LessonView | null) => void): () => void {
    this.subs.add(fn);
    fn(this.current);
    return () => this.subs.delete(fn);
  }

  update(ctx: LessonCtx, now: number, signals: readonly LessonSignal[] = []): void {
    this.now = now;
    const f: LessonFrame = { ctx, signals };
    this.frame = f;
    const wasBusy = this.busy;
    this.busy = ctx.busy;
    if (!ctx.busy) {
      if (this.deferred !== null && !this.open) {
        if (this.clock.speed() === 0) this.clock.setSpeed(this.deferred);
        this.deferred = null;
      } else if (wasBusy) this.applySpeed(); // a run step held back while busy gets its time now
    }
    if (!this.prefs.enabled()) {
      this.queue = [];
      if (this.open) this.close(false);
      return;
    }
    const o = this.open;
    if (o) {
      const step = o.def.steps[o.index];
      if (o.def.while && !checkCondition(o.def.while, f)) this.close(false);
      else if (step && step.advance !== 'gotIt' && checkCondition(step.advance, f)) this.next();
    }
    for (const def of this.defs) {
      if (this.prefs.isSeen(def.id) || this.open?.def === def || this.queue.some((q) => q.def === def)) continue;
      if (checkCondition(def.trigger, f)) this.queue.push({ def, at: now + (def.delay ?? 0) });
    }
    this.queue = this.queue.filter((q) => !q.def.while || checkCondition(q.def.while, f));
    if (!this.open && !ctx.busy && now >= this.cooldownUntil) {
      // The first lesson whose delay has passed (one still waiting does not hold up a later one that is ready).
      const i = this.queue.findIndex((q) => now >= q.at);
      const next = i >= 0 ? this.queue.splice(i, 1)[0] : undefined;
      if (next) this.start(next.def);
    }
  }

  /** Got it: the current step is read. A "do" step can be passed this way too (the card's Skip step). */
  gotIt(): void {
    if (this.open) this.next();
  }

  /** Close the lesson and do not show it again. */
  dismiss(): void {
    if (this.open) this.close(true);
  }

  /** Queue a lesson again even if seen (Help's "Show me how"). It still waits for its `while` and for the screen to be free. */
  replay(id: string): void {
    const def = this.defs.find((d) => d.id === id);
    if (!def || this.open?.def === def) return;
    this.queue = [{ def, at: this.now }, ...this.queue.filter((q) => q.def !== def)];
  }

  private start(def: LessonDef): void {
    const held = this.deferred ?? this.clock.speed();
    this.deferred = null;
    this.open = { def, index: 0, held };
    this.applySpeed();
    this.emit();
    // A do-step already satisfied (or a lesson whose situation already passed) settles on the same frame.
    if (this.frame) this.update(this.frame.ctx, this.now);
  }

  private next(): void {
    const o = this.open;
    if (!o) return;
    if (o.index + 1 >= o.def.steps.length) return this.close(true);
    o.index++;
    this.applySpeed();
    this.emit();
  }

  /** Paused unless the step runs time; a run step resumes the speed the player had, never unpausing a game they had paused. */
  private applySpeed(): void {
    const o = this.open;
    if (!o) return;
    const want = o.def.steps[o.index]?.run ? o.held : 0;
    const now = this.clock.speed();
    if (want === 0 && now !== 0) this.clock.setSpeed(0);
    else if (want !== 0 && now === 0 && !this.busy) this.clock.setSpeed(want);
  }

  private close(seen: boolean): void {
    const o = this.open;
    if (!o) return;
    if (seen) this.prefs.markSeen(o.def.id);
    this.open = null;
    // Back to the player's speed, unless they paused the game themselves before the lesson (or changed speed during it). Under a busy
    // screen the restore waits for it to close (see `deferred`).
    if (o.held !== 0) {
      if (this.busy) this.deferred = o.held;
      else if (this.clock.speed() === 0) this.clock.setSpeed(o.held);
    }
    this.cooldownUntil = this.now + this.cooldownMs;
    this.emit();
  }

  private emit(): void {
    const v = this.current;
    for (const fn of [...this.subs]) fn(v);
  }
}
