import type { Probe } from '../../sim/probe';
import { Profiler } from './profiler';
import { formatReport } from './report';

/** `window.__perf`: the agent-facing API. Every method returns plain data or a short string. */
export interface PerfApi {
  enable(): void;
  disable(): void;
  reset(): void;
  startRecording(): void;
  stopRecording(): ReturnType<Profiler['stopRecording']>;
  /** Compact JSON: top labels by self and total time, frame stats, budget overruns, counters, heap, recording analysis. */
  summary(topN?: number): ReturnType<Profiler['summary']>;
  /** Plain-text table sorted by self time. */
  report(rows?: number): string;
}

export interface ProfilerHandle {
  profiler: Profiler;
  api: PerfApi;
  togglePanel(): void;
}

let handle: ProfilerHandle | undefined;

/**
 * Count WebGL draw calls by wrapping the context prototypes once, each under the innermost open span (`where`; `-` outside
 * every span, e.g. a draw from an image-load callback). Returns a reader of the counts by span that also clears them.
 */
function installDrawCounter(where: () => string | null): () => Map<string, number> {
  let by = new Map<string, number>();
  for (const ctor of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!ctor) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const proto = ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      proto[name] = function (this: unknown, ...a: unknown[]) {
        const k = where() ?? '-';
        by.set(k, (by.get(k) ?? 0) + 1);
        return orig.apply(this, a);
      };
    }
  }
  return () => {
    const v = by;
    by = new Map();
    return v;
  };
}

/**
 * Build the profiler once (debug-only; main.ts imports this lazily) and hand `setProbe` the real probe while enabled and the
 * no-op while not. `?perf` or F3 turn it on; `window.__perf` is the agent API.
 */
export function installProfiler(setProbe: (p: Probe | null) => void): ProfilerHandle {
  if (handle) return handle;
  const mem = (): number | null => (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
  const profiler = new Profiler(() => performance.now(), mem);
  let readDraws: (() => Map<string, number>) | undefined;
  const enable = (): void => {
    if (!readDraws) {
      readDraws = installDrawCounter(() => profiler.tally.innermost);
      // The total, and the same split by the span that issued them (`draws@render/gl`), to tell which pass a draw-heavy frame came from.
      profiler.beforeFrameEnd = () => {
        let n = 0;
        for (const [k, v] of readDraws?.() ?? []) {
          n += v;
          profiler.count(`draws@${k}`, v);
        }
        profiler.count('render/drawCalls', n);
      };
    } else {
      // The draw wrappers keep counting while disabled: drop those draws so the first measured frame counts only its own.
      readDraws();
    }
    profiler.enabled = true;
    setProbe(profiler);
  };
  const disable = (): void => {
    profiler.enabled = false;
    setProbe(null);
  };
  const api: PerfApi = {
    enable,
    disable,
    reset: () => profiler.reset(),
    startRecording: () => profiler.startRecording(),
    stopRecording: () => profiler.stopRecording(),
    summary: (n) => profiler.summary(n),
    report: (rows) => formatReport(profiler.summary(Math.max(rows ?? 20, 12)), rows),
  };
  (window as unknown as { __perf: PerfApi }).__perf = api;
  let panel: { destroy(): void } | undefined;
  let explicit = false;
  handle = {
    profiler,
    api,
    togglePanel() {
      if (panel) {
        panel.destroy();
        panel = undefined;
        if (!explicit) disable();
        return;
      }
      explicit = profiler.enabled;
      enable();
      void import('./panel').then((m) => {
        panel = m.mountPanel(profiler, api);
      });
    },
  };
  return handle;
}
