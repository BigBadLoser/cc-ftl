import type { Command, ContentRegistry, Sim, SimEvent } from '../../sim';

/**
 * The scenario spec: every key is optional, and each key is owned by one part in `parts/` (which adds it here by declaration merging, so this
 * interface needs no edit when a part is added). A spec is plain data except where a preset passes a function (a step's `until`, a lazy
 * command list); only the data keys can be set from `?scenario=` overrides.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ScenarioSpec {}

/** What a scenario asks of the app (camera, selection, tool, speed). Data; tests and the profiler ignore it. */
export type UiRequest =
  | { kind: 'speed'; speed: 0 | 1 | 2 | 3 }
  | { kind: 'select'; crew: number; focus: boolean }
  | { kind: 'tool'; tool: { tool: 'build'; build: 'hull'; hull: { brush: 'rect'; erase: boolean; mirror: boolean } } }
  | { kind: 'frame'; target: 'station' }
  /** A debug preview of UI that has no sim behind it yet (the Health tab's surgery section, #601): data the app shows, nothing in play. */
  | { kind: 'preview'; what: 'operations' };

/** Everything a part's `apply` may use: the sim to read, the command queue, and the clock. A part changes the sim through commands. */
export interface BuildCtx {
  readonly sim: Sim;
  readonly content: ContentRegistry;
  readonly seed: number;
  /** Queue commands (the next `step` applies them). */
  enqueue(...cmds: Command[]): void;
  /** Step `n` ticks, draining events like the app loop and tallying rejected commands. Returns the events. */
  step(n?: number): SimEvent[];
  /** Step until `pred` holds (checked first, then after each tick); throws, naming `what`, if it does not within `max` ticks. */
  until(pred: () => boolean, max: number, what: string): void;
  ui(req: UiRequest): void;
  /** Hooks to attach to the finished scenario (see `parts/hooks.ts`). */
  attach(name: string, args?: unknown): void;
}

export interface CreateOpts { seed: number; content: ContentRegistry }

export interface Part<K extends keyof ScenarioSpec = keyof ScenarioSpec> {
  key: K;
  /** Parts of these keys apply first (only needed between parts that both appear in a spec). */
  after?: readonly (keyof ScenarioSpec)[];
  /** Only the `ship` part: build the sim. */
  create?(opts: CreateOpts, slice: ScenarioSpec[K]): Sim;
  apply(ctx: BuildCtx, slice: NonNullable<ScenarioSpec[K]>): void;
}
export const definePart = <K extends keyof ScenarioSpec>(p: Part<K>): Part<K> => p;

export type ParamKind = { kind: 'flag' } | { kind: 'number' } | { kind: 'string' } | { kind: 'oneOf'; values: readonly string[] };
export const flag = (): ParamKind => ({ kind: 'flag' });
export const num = (): ParamKind => ({ kind: 'number' });
export const str = (): ParamKind => ({ kind: 'string' });
export const oneOf = (...values: string[]): ParamKind => ({ kind: 'oneOf', values });
export type ParamValues = Record<string, boolean | number | string | undefined>;

export interface Preset {
  doc: string;
  /** Knobs settable from `?scenario=name&knob`: parsed by kind; anything undeclared is ignored. */
  params?: Record<string, ParamKind>;
  spec(params: ParamValues): ScenarioSpec;
  /** The hull `?starter=` defaults to for this preset (the roomy debug hull for ones that spawn a lot). */
  starter?: string;
  /** Profiler: ticks `profile:sim` runs after setup. */
  profile?: { ticks: number; populate?: boolean };
}
export const definePreset = (p: Preset): Preset => p;

/** Scenario hook: code that runs at a phase of a built scenario. It reads the sim and sends commands. Not `?hook` (the `__cc` debug API). */
export interface HookCtx {
  readonly sim: Sim;
  dispatch(cmd: Command): void;
  ui(req: UiRequest): void;
  /** Run `fn` once `ticks` ticks from now (tick-based, so deterministic and testable). */
  after(ticks: number, fn: () => void): void;
  /** Call `fn` once, the first tick `pred` holds; gives up silently after `max` ticks. */
  when(pred: () => boolean, fn: () => void, max?: number): void;
  /** Per-instance scratch state. */
  state: Record<string, unknown>;
  args: unknown;
}
export interface Hook {
  afterBuild?(ctx: HookCtx): void;
  tick?(ctx: HookCtx): void;
  event?(ctx: HookCtx, events: readonly SimEvent[]): void;
}
export const defineHook = (h: Hook): Hook => h;
