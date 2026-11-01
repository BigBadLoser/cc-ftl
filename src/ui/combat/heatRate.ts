/** Net heat rate (% of max per game second), smoothed so the readout does not flicker. */
export const HEAT_SAMPLE_TICKS = 6;
const KEEP = 0.55;

export interface HeatSample { tick: number; pct: number }

/** Fold a new sample into the running rate. Returns the new rate and the sample to remember (the old one is kept until enough ticks pass). */
export function nextHeatRate(rate: number, last: HeatSample | null, now: HeatSample, tickHz: number): { rate: number; last: HeatSample } {
  if (!last || now.tick < last.tick) return { rate, last: now };
  const dt = now.tick - last.tick;
  if (dt < HEAT_SAMPLE_TICKS) return { rate, last };
  const inst = (now.pct - last.pct) / (dt / tickHz);
  return { rate: Math.abs(rate) < 1e-6 ? inst : rate * KEEP + inst * (1 - KEEP), last: now };
}
