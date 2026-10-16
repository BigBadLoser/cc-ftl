import type { Sim } from './sim';

/**
 * Round a non-negative fractional amount down or up at random (deterministic, via sim.rng) so
 * tiny per-tick rates on integer fields still add up to the right average.
 */
export function stochasticRound(sim: Sim, v: number): number {
  const base = Math.floor(v);
  return base + (sim.rng.chance(v - base) ? 1 : 0);
}
