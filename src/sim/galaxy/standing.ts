import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import type { StandingTier } from './defs';
import { spillSources } from './relations';
import { FRIENDLY_AT, HOSTILE_BELOW, STANDING_SPILLOVER } from './tuning';
import { LAW_KINDS, WANTED_AT } from './tuningHeat';

/** The `sim.story.reputation` key of a galaxy faction (one per faction); an id without a def is its own key. */
export const repKey = (sim: Sim, faction: string): string => sim.content.galaxy?.factions[faction]?.reputation ?? faction;

/**
 * Faction standings on top of `sim.story.reputation`, the single reputation store. Every faction has its own key, so fighting one
 * faction or doing a job for it moves only its own number (and, through the relations table, a share of its friends' and rivals').
 * Trade's `reputationWith` and `hailVerdict` read the same numbers for prices and hailing. Used by the starmap for territory and arrivals:
 *   standing = baseStanding + reputation[own key] + STANDING_SPILLOVER x sum over related factions of spill weight x reputation[their key]
 * Tiers: hostile below HOSTILE_BELOW, friendly from FRIENDLY_AT, neutral between. `alwaysHostile` factions are hostile, and so is the law
 * (LAW_KINDS) while the player is wanted (notoriety at least WANTED_AT, heat.ts).
 * Ids without a def read as their raw reputation.
 */
export function standing(sim: Sim, faction: string): number {
  const defs = sim.content.galaxy?.factions ?? {};
  const def = defs[faction];
  let v = (def?.baseStanding ?? 0) + reputationOf(sim.story, repKey(sim, faction));
  const own = repKey(sim, faction);
  for (const src of sim.content.galaxy ? spillSources(sim.content.galaxy, faction) : []) {
    const key = repKey(sim, src.faction);
    // A faction sharing the subject's own key is already counted in full above.
    if (key !== own) v += STANDING_SPILLOVER * src.weight * reputationOf(sim.story, key);
  }
  return Math.round(v * 100) / 100;
}

export function tierOf(sim: Sim, faction: string): StandingTier {
  const def = sim.content.galaxy?.factions[faction];
  if (def?.alwaysHostile) return 'hostile';
  if (LAW_KINDS.includes(def?.kind ?? '') && sim.galaxy.heat.notoriety >= WANTED_AT) return 'hostile';
  const v = standing(sim, faction);
  if (v < HOSTILE_BELOW) return 'hostile';
  return v >= FRIENDLY_AT ? 'friendly' : 'neutral';
}

export const isHostileFaction = (sim: Sim, faction: string): boolean => tierOf(sim, faction) === 'hostile';

/** Every galaxy faction's standing and tier, in content order (for the UI). */
export function standings(sim: Sim): { faction: string; value: number; tier: StandingTier }[] {
  return Object.keys(sim.content.galaxy?.factions ?? {}).map((faction) => ({ faction, value: standing(sim, faction), tier: tierOf(sim, faction) }));
}
