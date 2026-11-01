/**
 * Observers (metrics, decisions) read the sim from inside probe calls, so their work would land in the enclosing `sim/tick` and `loop/frame` spans. The profile
 * run passes the profiler's excluded-span function instead (`Profiler.excluded`), which times the observer on its own line and takes it out of every open span.
 */
export type Excluder = (label: string, fn: () => void) => void;

/** No profiler: just run it. */
export const runPlain: Excluder = (_label, fn) => fn();

/** The label observers report under. */
export const OBSERVE_LABEL = 'profile/observe';
