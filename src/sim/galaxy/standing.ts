import type { Sim } from '../sim';
import { reputationOf } from '../story/state';
import type { StandingTier } from './defs';
import { FRIENDLY_AT, HOSTILE_BELOW, STANDING_SPILLOVER } from './tuning';

/**
 * Faction standings on top of `sim.story.reputation` (the event system's reputation per faction id). Shared by the
 * starmap (territory, arrivals) and trade (prices, hailing):
 *   standing = baseStanding + reputation + STANDING_SPILLOVER x sum over others of relation x their reputation
 * Tiers: hostile below HOSTILE_BELOW, friendly from FRIENDLY_AT, neutral between. `alwaysHostile` factions are hostile.
 * Factions without a def (old reputation keys) read as their raw reputation.
 */
export function standing(sim: Sim, faction: string): number {
  const defs = sim.content.galaxy?.factions ?? {};
  const def = defs[faction];
  let v = (def?.baseStanding ?? 0) + reputationOf(sim.story, faction);
  for (const [other, rel] of Object.entries(def?.relations ?? {})) v += STANDING_SPILLOVER * rel * reputationOf(sim.story, other);
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
