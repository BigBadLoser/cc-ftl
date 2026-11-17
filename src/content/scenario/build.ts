import type { Command, Sim, SimEvent } from '../../sim';
import { content as defaultContent } from '..';
import { mergeSpec } from './merge';
import { checkSpec, hooks as hookRegistry, parts, presets } from './registry';
import type { BuildCtx, Hook, HookCtx, ParamValues, ScenarioSpec, UiRequest } from './types';

/** A built scenario: the sim, what it asked of the app, and the hooks still to run. Drive it with `afterTick`/`onEvents` (the app loop) or `play` (tests, the profiler). */
export interface Built {
  sim: Sim;
  /** UI requests made while building (the app applies them once). */
  requests: UiRequest[];
  /** Rejected commands during the build, `command:reason` -> count (a smoke test asserts none that matter). */
  rejected: Record<string, number>;
  /** The names and args of the attached hooks (a cached clone re-attaches them: hooks are not saved state). */
  hookRefs: { name: string; args?: unknown }[];
  /** Where hook commands go (default: the sim's queue; the app sets its bridge). */
  setDispatch(fn: (cmd: Command) => void): void;
  /** Where later UI requests go (the app); build-time ones are in `requests`. */
  listen(fn: (req: UiRequest) => void): void;
  /** Call after every `sim.step()`. */
  afterTick(): void;
  /** Call with the events a step produced. */
  onEvents(events: readonly SimEvent[]): void;
}

export interface BuildOpts {
  seed?: number;
  content?: typeof defaultContent;
  /** Use this sim instead of building one (the app's own start, a cached clone): the `ship` part's creation is skipped. */
  sim?: Sim;
  /** The preset's declared knobs. */
  params?: ParamValues;
  /** A partial spec laid over the preset's (see `mergeSpec`). */
  overrides?: ScenarioSpec;
  /** Hooks to add by name (`?scenario=x&hooks=a,b`). */
  extraHooks?: readonly string[];
}

/** Attach `refs` to `sim` as live hooks (running `afterBuild` when `afterBuild` is set). */
export function attachHooks(sim: Sim, refs: readonly { name: string; args?: unknown }[], afterBuild: boolean, base?: Partial<Built>): Built {
  const requests: UiRequest[] = [];
  let dispatch: (cmd: Command) => void = (c) => sim.enqueue(c);
  let listener: ((req: UiRequest) => void) | undefined;
  const ui = (req: UiRequest): void => void (listener ? listener(req) : requests.push(req));
  const timers: { at: number; fn: () => void }[] = [];
  const waits: { pred: () => boolean; fn: () => void; until: number }[] = [];
  const live: { hook: Hook; ctx: HookCtx }[] = [];
  for (const ref of refs) {
    const hook = hookRegistry.get(ref.name);
    if (!hook) throw new Error(`scenario: unknown hook "${ref.name}"`);
    const ctx: HookCtx = {
      sim, dispatch: (c) => dispatch(c), ui, state: {}, args: ref.args,
      after: (ticks, fn) => void timers.push({ at: sim.tick + ticks, fn }),
      when: (pred, fn, max = 2400) => void waits.push({ pred, fn, until: sim.tick + max }),
    };
    live.push({ hook, ctx });
  }
  const built: Built = {
    sim, requests: base?.requests ?? requests, rejected: base?.rejected ?? {}, hookRefs: [...refs],
    setDispatch: (fn) => void (dispatch = fn),
    listen: (fn) => void (listener = fn),
    afterTick() {
      for (const l of live) l.hook.tick?.(l.ctx);
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i]!.at <= sim.tick) timers.splice(i, 1)[0]!.fn();
      for (let i = waits.length - 1; i >= 0; i--) {
        const w = waits[i]!;
        if (w.pred()) { waits.splice(i, 1); w.fn(); } else if (sim.tick >= w.until) waits.splice(i, 1);
      }
    },
    onEvents(events) { for (const l of live) l.hook.event?.(l.ctx, events); },
  };
  if (afterBuild) for (const l of live) l.hook.afterBuild?.(l.ctx);
  return built;
}

/**
 * Build a scenario: a preset by name (or a spec written in code), its params and overrides applied, then every part of the spec in order. Synchronous:
 * the build steps the sim itself, so the result is the finished scene (a test starts from it, the app opens on it).
 */
export function buildScenario(source: string | ScenarioSpec, opts: BuildOpts = {}): Built {
  let spec: ScenarioSpec;
  if (typeof source === 'string') {
    const preset = presets.get(source);
    if (!preset) throw new Error(`scenario: unknown preset "${source}" (known: ${[...presets.keys()].join(', ')})`);
    spec = preset.spec(opts.params ?? {});
  } else spec = source;
  spec = mergeSpec(spec, opts.overrides);
  checkSpec(spec);
  const content = opts.content ?? defaultContent;
  const seed = opts.seed ?? (spec as { ship?: { seed?: number } }).ship?.seed ?? 1;
  const creator = parts.find((p) => p.create);
  const sim = opts.sim ?? creator?.create?.({ seed, content }, (spec as Record<string, never>)[creator.key]);
  if (!sim) throw new Error('scenario: no part can create a sim');
  const rejected: Record<string, number> = {};
  const requests: UiRequest[] = [];
  const refs: { name: string; args?: unknown }[] = [];
  let pending = 0;
  const ctx: BuildCtx = {
    sim, content, seed,
    enqueue: (...cmds) => void cmds.forEach((c) => { sim.enqueue(c); pending++; }),
    step(n = 1) {
      pending = 0;
      const seen: SimEvent[] = [];
      for (let i = 0; i < n; i++) {
        sim.step();
        for (const e of sim.events.drain() as SimEvent[]) {
          seen.push(e);
          if (e.type === 'command.rejected') rejected[`${e.command}:${e.reason}`] = (rejected[`${e.command}:${e.reason}`] ?? 0) + 1;
        }
      }
      return seen;
    },
    until(pred, max, what) {
      for (let i = 0; !pred(); i++) {
        if (i >= max) throw new Error(`scenario: "${what}" did not happen within ${max} ticks (tick ${sim.tick})`);
        ctx.step();
      }
    },
    ui: (req) => void requests.push(req),
    attach: (name, args) => void refs.push({ name, ...(args === undefined ? {} : { args }) }),
  };
  for (const part of parts) {
    const slice = (spec as Record<string, unknown>)[part.key];
    if (slice !== undefined) (part.apply as (c: BuildCtx, s: unknown) => void)(ctx, slice);
  }
  if (pending) ctx.step(); // commands queued by the last part: applied before the scene is handed over
  for (const name of opts.extraHooks ?? []) refs.push({ name });
  return attachHooks(sim, refs, true, { requests, rejected });
}

export interface PlayOpts { until?: (sim: Sim) => boolean }

/** Step a built scenario up to `ticks` ticks with its hooks running, draining events; the hook-aware `run`. Returns the events. */
export function play(built: Built, ticks: number, opts: PlayOpts = {}): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    built.sim.step();
    built.afterTick();
    const ev = built.sim.events.drain() as SimEvent[];
    built.onEvents(ev);
    all.push(...ev);
    if (opts.until?.(built.sim)) break;
  }
  return all;
}
