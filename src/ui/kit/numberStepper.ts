/** Pure helpers behind NumberStepper (kept apart so they can be unit tested without a DOM). */

/** How a step is taken: a fixed size, or a function of the current value and direction (for accelerating steps). */
export type StepSpec = number | ((value: number, dir: 1 | -1) => number);

export function clampNumber(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** The value after one step in `dir`, clamped to [min, max]. A function spec returns the new value directly. */
export function stepValue(value: number, dir: 1 | -1, step: StepSpec, min: number, max: number): number {
  const next = typeof step === 'function' ? step(value, dir) : value + dir * step;
  return clampNumber(next, min, max);
}

/** Parse typed text: whole numbers, clamped; anything unparseable falls back to `fallback`. */
export function parseEntry(text: string, fallback: number, min: number, max: number): number {
  const t = text.trim().replace(/−/g, '-');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return fallback;
  return clampNumber(Math.round(Number(t)), min, max);
}
