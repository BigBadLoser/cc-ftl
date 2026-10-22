import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import type { StandingTier } from './defs';
import { FRIENDLY_AT, HOSTILE_BELOW, STANDING_SPILLOVER } from './tuning';

/** The `sim.story.reputation` key of a galaxy faction (the key trade uses too); an id without a def is its own key. */
export const repKey = (sim: Sim, faction: string): string => sim.content.galaxy?.factions[faction]?.reputation ?? faction;

/**
 * Faction standings on top of `sim.story.reputation`, the single reputation store (trade's `reputationWith` and
 * `hailVerdict` read the same numbers and stay the source of truth for prices and hailing; this only reads them). Used by the
 * starmap for territory and arrivals:
 *   standing = baseStanding + reputation[own key] + STANDING_SPILLOVER x sum over others of relation x reputation[their key]
 * Tiers: hostile below HOSTILE_BELOW, friendly from FRIENDLY_AT, neutral between. `alwaysHostile` factions are hostile.
 * Ids without a def read as their raw reputation.
 */
export function standing(sim: Sim, faction: string): number {
  const defs = sim.content.galaxy?.factions ?? {};
  const def = defs[faction];
  let v = (def?.baseStanding ?? 0) + reputationOf(sim.story, repKey(sim, faction));
  for (const [other, rel] of Object.entries(def?.relations ?? {})) {
    const key = repKey(sim, other);
    // Factions sharing the subject's own key are already counted in full above.
    if (key !== (def?.reputation ?? faction)) v += STANDING_SPILLOVER * rel * reputationOf(sim.story, key);
  }
  return Math.round(v * 100) / 100;
}

export function tierOf(sim: Sim, faction: string): StandingTier {
  if (sim.content.galaxy?.factions[faction]?.alwaysHostile) return 'hostile';
  const v = standing(sim, faction);
  if (v < HOSTILE_BELOW) return 'hostile';
  return v >= FRIENDLY_AT ? 'friendly' : 'neutral';
}

export const isHostileFaction = (sim: Sim, faction: string): boolean => tierOf(sim, faction) === 'hostile';

/** Every galaxy faction's standing and tier, in content order (for the UI). */
export function standings(sim: Sim): { faction: string; value: number; tier: StandingTier }[] {
  return Object.keys(sim.content.galaxy?.factions ?? {}).map((faction) => ({ faction, value: standing(sim, faction), tier: tierOf(sim, faction) }));
}
