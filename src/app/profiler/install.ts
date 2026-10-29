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

/** Count WebGL draw calls by wrapping the context prototypes once; returns a reader that also clears the count. */
function installDrawCounter(): () => number {
  let n = 0;
  for (const ctor of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
    if (!ctor) continue;
    for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
      const proto = ctor.prototype as unknown as Record<string, (...a: unknown[]) => unknown>;
      const orig = proto[name];
      if (typeof orig !== 'function') continue;
      proto[name] = function (this: unknown, ...a: unknown[]) {
        n++;
        return orig.apply(this, a);
      };
    }
  }
  return () => {
    const v = n;
    n = 0;
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
  let readDraws: (() => number) | undefined;
  const enable = (): void => {
    if (!readDraws) {
      readDraws = installDrawCounter();
      profiler.beforeFrameEnd = () => profiler.count('render/drawCalls', readDraws?.() ?? 0);
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
