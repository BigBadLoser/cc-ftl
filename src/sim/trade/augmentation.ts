import type { Sim } from '../sim';

/**
 * How many of the player's crew are heavily augmented. The zealots talk to a ship whose crew is machine-touched enough (`TradeFactionDef.augmentBonus`).
 * TODO(phase 7): count crew whose implants reach the threshold. Implants do not exist yet, so this is a stub that always counts 0, and the zealots
 * trade only on standing for now.
 */
export function augmentedCrew(sim: Sim): number {
  void sim; // the stub reads nothing yet
  return 0;
}
