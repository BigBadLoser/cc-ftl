import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { nodeOf } from './state';
import { isHostileFaction } from './standing';
import { GRACE_ACT, GRACE_SEC } from './tuning';

/**
 * The opening grace period (combat onboarding): until GRACE_SEC of game time have passed, or the first goal act ("Get underway", index GRACE_ACT) is done (or the chain is skipped),
 * nothing hostile turns up on its own at a danger-0 node. It covers raider and scavenger arrivals, fleets (hunters among them) that would become real
 * ships in the player's node, and their interdictions of a hop that ends there. Never what the player picked: a bounty target waits as a node contact
 * (not a fleet), event-grid fights and story events are not gated.
 */
export function graceActive(sim: Sim): boolean {
  const goals = sim.story.goals;
  return sim.tick < GRACE_SEC * TICK_HZ && !goals.skipped && goals.act <= GRACE_ACT;
}

/** Is an unprompted hostile arrival at `node` held back right now? */
export function graceHolds(sim: Sim, node: string, faction?: string): boolean {
  if (!graceActive(sim) || nodeOf(sim, node)?.danger !== 0) return false;
  return faction === undefined || isHostileFaction(sim, faction);
}
