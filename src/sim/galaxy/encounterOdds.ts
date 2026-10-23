import { CombatC } from '../combat/components';
import type { Sim } from '../sim';
import { standing } from './standing';
import { SKILL_STEP } from '../tuning';
import {
  BRIBE_MIN, BRIBE_PER_DANGER, BRIBE_PER_STRENGTH, BRIBE_STANDING, EVADE_ENGINES_FULL, EVADE_ENGINE_FLOOR, EVADE_MAX, EVADE_MIN, EVADE_PILOT_BASE,
  EVADE_PILOT_SPAN, EVADE_PER_STRENGTH, EVADE_TOP_SKILL, STRENGTH_PER_DEPTH,
} from './tuning';
import type { Contact, Encounter } from './types';
import { playerShipInfo } from './arrivals';

/**
 * The numbers behind an interdiction (planner's calls, see docs/STATUS.md):
 * - strength of a fleet = sum over ships of (1 + depth x STRENGTH_PER_DEPTH): a lone depth-1 raider is 1.5, three depth-3 ships 7.5.
 * - evade odds: driven mainly by the pilot (formula and examples in tuning.ts). The helm's state is read from the ship's combat state (from the packet in hyperspace):
 *   `evasion` is 0 without a pilot at a powered, intact helm or without powered engines; `pilot` is the helm operator's piloting skill (or, with the helm unmanned, the best pilot aboard: the cruise figures).
 * - bribe = BRIBE_PER_STRENGTH x strength x (1 + danger x BRIBE_PER_DANGER) x (1 - BRIBE_STANDING x standing with the faction, clamped to [0.5, 2]),
 *   rounded, at least BRIBE_MIN. A faction that likes you asks less; one that hates you asks more.
 */
export const fleetStrength = (ships: readonly Contact[]): number => ships.reduce((n, c) => n + 1 + c.depth * STRENGTH_PER_DEPTH, 0);

/** The player's helm: ship evasion (0 with no pilot or no powered engines) and the pilot's piloting skill. Zeros when there is no ship. */
export function playerHelm(sim: Sim): { evasion: number; pilot: number } {
  const p = sim.sector.packet;
  const c = sim.sector.state === 'hyperspace' && p
    ? (p.entities.find((e) => e.id === p.ship)?.c['combat'] as { evasion?: number; pilot?: number; cruiseEvasion?: number; cruisePilot?: number } | undefined)
    : (() => { const me = playerShipInfo(sim); return me ? sim.world.get(me.id, CombatC) : undefined; })();
  // A manned helm (combat) decides; under way nobody mans it, so the best pilot aboard flies.
  const manned = { evasion: c?.evasion ?? 0, pilot: c?.pilot ?? 0 };
  if (manned.pilot > 0 && manned.evasion > 0) return manned;
  return { evasion: c?.cruiseEvasion ?? 0, pilot: c?.cruisePilot ?? 0 };
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Chance (0..1) an evade roll succeeds against a fleet of this strength with this helm. */
export function evadeOddsFor(helm: { evasion: number; pilot: number }, strength: number): number {
  if (helm.evasion <= 0) return EVADE_MIN;
  const pilot = clamp(helm.pilot / EVADE_TOP_SKILL, 0, 1);
  const engine = clamp(helm.evasion / (1 + SKILL_STEP * helm.pilot) / EVADE_ENGINES_FULL, 0, 1);
  const p = (EVADE_PILOT_BASE + EVADE_PILOT_SPAN * pilot) * (EVADE_ENGINE_FLOOR + (1 - EVADE_ENGINE_FLOOR) * engine) - strength * EVADE_PER_STRENGTH;
  return Math.round(clamp(p, EVADE_MIN, EVADE_MAX) * 1000) / 1000;
}

/** Chance (0..1) an evade roll succeeds against this encounter's fleet. */
export const evadeOdds = (sim: Sim, e: Encounter): number => evadeOddsFor(playerHelm(sim), e.strength);

/** Credits the fleet asks to let the player pass. */
export function bribeCost(sim: Sim, e: Encounter): number {
  const mod = clamp(1 - BRIBE_STANDING * standing(sim, e.faction), 0.5, 2);
  return Math.max(BRIBE_MIN, Math.round(BRIBE_PER_STRENGTH * e.strength * (1 + e.danger * BRIBE_PER_DANGER) * mod));
}
