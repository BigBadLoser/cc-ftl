import type { Command, Sim } from '../../../sim';
import type { BuildCtx } from '../types';

/** One scripted step: queue commands, step, and/or run until a condition. Code-only (functions); not settable from the URL. */
export interface Step {
  cmds?: readonly Command[] | ((ctx: BuildCtx) => readonly Command[]);
  /** Anything else a scene needs that is a few reads and commands (it may step through `ctx`): runs after `cmds` and `ticks`. */
  run?: (ctx: BuildCtx) => void;
  /** Ticks to step after queueing (default 1 when there are commands, else 0). */
  ticks?: number;
  /** Then step until this holds (throws past `max`, default 6000, naming `what`). */
  until?: (sim: Sim) => boolean;
  max?: number;
  what?: string;
  /** Stop quietly at `max` instead of throwing (for a wait that a variant of the scenario never satisfies). */
  soft?: boolean;
  /** Called after every tick of `until` (e.g. clear an open decision so it does not hold the clock). */
  each?: (sim: Sim) => void;
}

/** Run a script of steps in order. */
export function runSteps(ctx: BuildCtx, steps: readonly Step[]): void {
  for (const s of steps) {
    const cmds = typeof s.cmds === 'function' ? s.cmds(ctx) : s.cmds ?? [];
    ctx.enqueue(...cmds);
    ctx.step(s.ticks ?? (cmds.length ? 1 : 0));
    s.run?.(ctx);
    if (s.until) {
      const max = s.max ?? 6000;
      for (let i = 0; !s.until(ctx.sim); i++) {
        if (i >= max && s.soft) break;
        if (i >= max) throw new Error(`scenario: "${s.what ?? 'step'}" did not happen within ${max} ticks (tick ${ctx.sim.tick})`);
        ctx.step();
        s.each?.(ctx.sim);
      }
    }
  }
}
