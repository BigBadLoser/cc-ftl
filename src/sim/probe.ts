/**
 * Measurement hooks. The sim, render, ui and loop report cost through a Probe and know nothing about who listens. The real
 * probe (with a clock) lives in src/app/profiler; the sim only ever sees this type and the no-op below, so it stays pure.
 * Labels are hierarchical by slash: `sim/<system>`, `render/main`, `ui/snapshot`, `loop/frame`.
 */
export interface Probe {
  /** Start timing `label`. Calls nest; every begin needs a matching end with the same label. */
  begin(label: string): void;
  end(label: string): void;
  /** Add `n` (default 1) to a counter, e.g. draw calls, ticks per frame. */
  count(label: string, n?: number): void;
}

/** Does nothing; the default everywhere. */
export const NOOP_PROBE: Probe = {
  begin() {},
  end() {},
  count() {},
};
