import { TICK_HZ, type Sim, type SimEvent } from '../sim';

export type Speed = 0 | 1 | 2 | 3;

export const MAX_STEPS_PER_FRAME = 5;
/** Longest real frame time we account for; longer gaps (tab switch) are clamped. */
export const MAX_FRAME_MS = 250;

export interface StepResult {
  steps: number;
  /** Leftover accumulator in ms, always < one step. */
  acc: number;
}

/** Pure fixed-step accounting: how many sim steps to run for `dtMs` of real time at `speed`. */
export function advance(acc: number, dtMs: number, speed: Speed, tickHz = TICK_HZ, maxSteps = MAX_STEPS_PER_FRAME): StepResult {
  if (speed === 0) return { steps: 0, acc: 0 };
  const stepMs = 1000 / tickHz;
  acc += Math.min(Math.max(dtMs, 0), MAX_FRAME_MS) * speed;
  let steps = Math.floor(acc / stepMs);
  acc -= steps * stepMs;
  if (steps > maxSteps) {
    steps = maxSteps;
    acc = 0; // drop the backlog instead of spiralling
  }
  return { steps, acc };
}

export interface FrameStats {
  tick: number;
  entityCount: number;
  fps: number;
  frameMs: number;
  tickMs: number;
}

export interface LoopOptions {
  sim: Sim;
  /** Called every frame with the interpolation fraction in [0,1). */
  render: (alpha: number) => void;
  /** Called each frame with the events emitted by that frame's ticks (output only). */
  onEvents?: (events: SimEvent[]) => void;
  /** Called every frame after steps and event draining. */
  onFrame: (stats: FrameStats) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
  setSpeed(speed: Speed): void;
  getSpeed(): Speed;
  readonly alpha: number;
}

const ROLL = 30;

export function createLoop(opts: LoopOptions): Loop {
  const { sim } = opts;
  let speed: Speed = 1;
  let acc = 0;
  let alpha = 0;
  let last = 0;
  let raf = 0;
  let running = false;
  const frameTimes: number[] = [];
  const tickTimes: number[] = [];
  const push = (arr: number[], v: number) => {
    arr.push(v);
    if (arr.length > ROLL) arr.shift();
  };
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = last ? now - last : 0;
    last = now;
    push(frameTimes, dt);
    const r = advance(acc, dt, speed);
    acc = r.acc;
    for (let i = 0; i < r.steps; i++) {
      const t0 = performance.now();
      sim.step();
      push(tickTimes, performance.now() - t0);
    }
    const events = sim.events.drain();
    if (events.length) opts.onEvents?.(events);
    alpha = speed === 0 ? 0 : acc / (1000 / TICK_HZ);
    opts.render(alpha);
    const frameMs = avg(frameTimes);
    opts.onFrame({
      tick: sim.tick,
      entityCount: sim.world.entityCount,
      fps: frameMs > 0 ? 1000 / frameMs : 0,
      frameMs,
      tickMs: avg(tickTimes),
    });
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    setSpeed(s) {
      speed = s;
    },
    getSpeed: () => speed,
    get alpha() {
      return alpha;
    },
  };
}
