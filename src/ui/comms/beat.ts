/**
 * A irregular pulse for glitch effects: every `every` ms (jittered 0.6 to 1.4x) it plays `frames` (alternating on/off durations in ms, starting "on"),
 * calling `set(true|false)`. Returns a stop function. Used by FlickerText and VideoFeed; takes nothing about what flickers.
 */
export function startBeat(set: (on: boolean) => void, every: number, frames: readonly number[] = [70, 50, 70]): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dead = false;
  const play = (i: number): void => {
    if (dead) return;
    if (i >= frames.length) { set(false); wait(); return; }
    set(i % 2 === 0);
    timer = setTimeout(() => play(i + 1), frames[i]);
  };
  const wait = (): void => {
    if (dead) return;
    timer = setTimeout(() => play(0), every * (0.6 + Math.random() * 0.8));
  };
  wait();
  return () => { dead = true; clearTimeout(timer); set(false); };
}

/** True when the player asked the system for less motion: effects then hold still. */
export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
