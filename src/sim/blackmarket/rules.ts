import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import type { Trader } from '../trade/types';
import { zealotRule } from './services';
import { ZEALOT_MIN_AUGMENTED, ZEALOT_MIN_STANDING } from './tuning';

/**
 * Trade rules a market set can impose on the hail. The zealot rule (a machine-god cult's bazaar) lets the player trade with a standing of at least
 * ZEALOT_MIN_STANDING with the cult, or enough heavily augmented crew. Stub: augmentation reads implants (phase 7), so the crew count is 0 until they
 * land, and the standing is read from the owner's reputation key (the owner is a string id; with no such faction yet the trade faction's key applies).
 */

/** Crew of the player that are heavily augmented. TODO(implants, phase 7): count crew whose implants pass a threshold. */
export function augmentedCrew(sim: Sim): number {
  void sim;
  return 0;
}

/** The rule's verdict for a hail: true when it lets the player trade. Sets with no rule always do. */
export function ruleAllows(sim: Sim, t: Trader, reputationKey: string | undefined): boolean {
  if (!zealotRule(sim, t)) return true;
  const standing = reputationKey ? reputationOf(sim.story, reputationKey) : 0;
  return standing >= ZEALOT_MIN_STANDING || augmentedCrew(sim) >= ZEALOT_MIN_AUGMENTED;
}
