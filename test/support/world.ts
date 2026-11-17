import { deserialize, serialize } from '../../src/sim/save';
import type { SimEvent } from '../../src/sim/events';
import type { Sim } from '../../src/sim/sim';
import type { ContentRegistry } from '../../src/sim/registry';
import { run } from './run';

export interface ReplayOpts {
  /** Compare the saved state of the two sims every this many ticks (and at the end). Default 10: per-tick comparison is expensive. */
  every?: number;
  /** Also save and reload the second sim at this tick (`serialize` then `deserialize`), then keep comparing. */
  saveAt?: number;
  /** Filled with every event the first sim drained while stepping (not those of `build`), for a test that also asserts something happened in the run. */
  events?: SimEvent[];
}

/** First compared tick at which the two sims' saved state differs, or null. */
function firstDivergence(build: () => Sim, ticks: number, every: number, saveAt: number | undefined, events?: SimEvent[]): number | null {
  const a = build();
  let b = build();
  if (serialize(a) !== serialize(b)) return 0;
  for (let t = 1; t <= ticks; t++) {
    const ev = run(a, 1);
    if (events) events.push(...ev);
    run(b, 1);
    if (t === saveAt) b = deserialize(serialize(b), b.content);
    if ((t % every === 0 || t === ticks) && serialize(a) !== serialize(b)) return t;
  }
  return null;
}

/**
 * Determinism and save round-trip in one: build two sims from the same `build()`, step both `ticks` ticks and require their
 * `serialize` output to stay identical. With `saveAt` one of them is saved and reloaded on the way, so a field that does not
 * survive a save shows up as a divergence. On a mismatch the run is repeated comparing every tick to name the exact first
 * tick that differs, so a failure costs more than a pass.
 */
export function expectReplayable(build: () => Sim, ticks: number, opts: ReplayOpts = {}): void {
  const every = Math.max(1, opts.every ?? 10);
  if (firstDivergence(build, ticks, every, opts.saveAt, opts.events) === null) return;
  const exact = firstDivergence(build, ticks, 1, opts.saveAt);
  const what = opts.saveAt === undefined ? 'two runs' : `a run and its reload at tick ${opts.saveAt}`;
  throw new Error(`${what} diverge: first differing saved state at tick ${exact ?? 'unknown (not reproducible per tick)'} (of ${ticks})`);
}

const built = new Map<string, { json: string; content: ContentRegistry }>();

/**
 * A fresh, independent copy of an expensive starting world. `build` runs once per key per worker (vitest runs most files with
 * `isolate: false`, so the cache is shared by every file a worker runs: that is the point); every call returns
 * `deserialize(serialize(built))`, so tests cannot affect each other through it.
 *
 * Limits. A clone is exactly what a save holds: anything the sim keeps outside `serialize` is rebuilt, not copied (the
 * `sim.events` buffer starts empty, generated galaxy chunks and per-Sim memo caches refill on demand). That is the same
 * rule a player's reload follows, so a test that needs the unsaved state to carry over must build fresh. Keys name the
 * world, not the file: two builds that differ in any way need two keys. Do not mutate what `build` closes over.
 */
export function cachedWorld(key: string, build: () => Sim): Sim {
  let entry = built.get(key);
  if (!entry) {
    const sim = build();
    entry = { json: serialize(sim), content: sim.content };
    built.set(key, entry);
  }
  return deserialize(entry.json, entry.content);
}
