import type { SimEvent } from '../../src/sim/events';
import type { Sim } from '../../src/sim/sim';

/** Stop conditions for the run helpers. Both are optional and may be combined. */
export interface RunOpts {
  /** Checked after each step: the run ends (that step included) once it returns true. */
  until?: (sim: Sim) => boolean;
  /** Checked before each step, the first one too: the run ends without stepping once it returns true. */
  stopBefore?: (sim: Sim) => boolean;
}

/** What a run did: the ticks it stepped, every event it drained, and the events as log strings (see `logLine`). */
export interface RunResult {
  ticks: number;
  events: SimEvent[];
  log: string[];
}

/** The log string of an event: its type, and for a rejected command `command.rejected:<command>:<reason>`. */
export const logLine = (e: SimEvent): string => (e.type === 'command.rejected' ? `${e.type}:${e.command}:${e.reason}` : e.type);

/**
 * Step `sim` up to `ticks` times, draining its events after every step, and return everything that happened.
 * The core of `run` and `runLog`; use it directly when a test needs the tick count too.
 */
export function runSim(sim: Sim, ticks: number, opts: RunOpts = {}): RunResult {
  const events: SimEvent[] = [];
  let n = 0;
  while (n < ticks && !opts.stopBefore?.(sim)) {
    sim.step();
    n++;
    events.push(...(sim.events.drain() as SimEvent[]));
    if (opts.until?.(sim)) break;
  }
  return { ticks: n, events, log: events.map(logLine) };
}

/** Step up to `ticks` times and return the events drained (a test that ignores the result just advances time). */
export const run = (sim: Sim, ticks: number, opts?: RunOpts): SimEvent[] => runSim(sim, ticks, opts).events;

/** Step up to `ticks` times and return the events as log strings (`logLine`). */
export const runLog = (sim: Sim, ticks: number, opts?: RunOpts): string[] => runSim(sim, ticks, opts).log;

/** Step `ticks` times without draining events: for a test that reads `sim.events` itself afterwards. `stopBefore` as in `run`. */
export function step(sim: Sim, ticks: number, opts: Pick<RunOpts, 'stopBefore'> = {}): void {
  for (let i = 0; i < ticks && !opts.stopBefore?.(sim); i++) sim.step();
}
