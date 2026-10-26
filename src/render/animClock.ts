/**
 * The render's animation clock, in ms. It runs with `performance.now()` while the game runs and stands still while it is
 * paused, so everything animated by the world (module and crew clips, flicker, pulses, particles, the engine flame, the
 * dock and launch sequences) freezes with the sim. The camera, the UI and hover or aiming feedback keep real time.
 */
let paused = false;
/** Real ms the clock is behind `performance.now()` (the time spent paused so far). */
let lag = 0;
/** The clock's reading when it was paused. */
let frozenAt = 0;

/** Animation time now (ms). */
export function animNow(): number {
  return paused ? frozenAt : performance.now() - lag;
}

/** Freeze or resume the animation clock (idempotent). */
export function setAnimPaused(on: boolean): void {
  if (on === paused) return;
  if (on) frozenAt = performance.now() - lag;
  else lag = performance.now() - frozenAt;
  paused = on;
}

/** True while the animation clock stands still. */
export function animPaused(): boolean {
  return paused;
}
