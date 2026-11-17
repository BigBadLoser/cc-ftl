import type { Command, Sim } from '../../../sim';
import { definePart, type BuildCtx } from '../types';

/** One scripted step: queue commands, step, and/or run until a condition. Code-only (functions); not settable from the URL. */
export interface Step {
  cmds?: readonly Command[] | ((ctx: BuildCtx) => readonly Command[]);
  /** Ticks to step after queueing (default 1 when there are commands, else 0). */
  ticks?: number;
  /** Then step until this holds (throws past `max`, default 6000, naming `what`). */
  until?: (sim: Sim) => boolean;
  max?: number;
  what?: string;
  /** Called after every tick of `until` (e.g. clear an open decision so it does not hold the clock). */
  each?: (sim: Sim) => void;
}
declare module '../types' { interface ScenarioSpec { steps?: readonly Step[] } }

/** The escape hatch of a preset: an ordered script of commands and waits, run after every other part. */
export default definePart<'steps'>({
  key: 'steps',
  after: ['ship', 'node', 'items'],
  apply(ctx, steps) {
    for (const s of steps) {
      const cmds = typeof s.cmds === 'function' ? s.cmds(ctx) : s.cmds ?? [];
      ctx.enqueue(...cmds);
      ctx.step(s.ticks ?? (cmds.length ? 1 : 0));
      if (s.until) {
        const max = s.max ?? 6000;
        for (let i = 0; !s.until(ctx.sim); i++) {
          if (i >= max) throw new Error(`scenario: "${s.what ?? 'step'}" did not happen within ${max} ticks (tick ${ctx.sim.tick})`);
          ctx.step();
          s.each?.(ctx.sim);
        }
      }
    }
  },
});
