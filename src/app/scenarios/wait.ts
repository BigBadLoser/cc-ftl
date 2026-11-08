import type { Sim } from '../../sim';

/**
 * Run `then` once the sim has run `ticks` ticks, however slow the first frames are. A scenario that jumps at once must wait: before the
 * first ticks nothing is powered and the helm has no cruise figures, so the trip's evade odds sit at their floor (#367).
 */
export function afterTicks(sim: Sim, ticks: number, then: () => void): void {
  if (sim.tick >= ticks) then();
  else setTimeout(() => afterTicks(sim, ticks, then), 150);
}
