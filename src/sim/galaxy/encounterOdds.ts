import { CombatC } from '../combat/components';
import type { Sim } from '../sim';
import { standing } from './standing';
import {
  BRIBE_MIN, BRIBE_PER_DANGER, BRIBE_PER_STRENGTH, BRIBE_STANDING, EVADE_BASE, EVADE_MAX, EVADE_MIN, EVADE_PER_EVASION, EVADE_PER_STRENGTH,
  STRENGTH_PER_DEPTH,
} from './tuning';
import type { Contact, Encounter } from './types';
import { playerShipInfo } from './arrivals';

/**
 * The numbers behind an interdiction (planner's calls, see docs/STATUS.md):
 * - strength of a fleet = sum over ships of (1 + depth x STRENGTH_PER_DEPTH): a lone depth-1 raider is 1.5, three depth-3 ships 7.5.
 * - evade odds = EVADE_BASE + evasion x EVADE_PER_EVASION - strength x EVADE_PER_STRENGTH, clamped to [EVADE_MIN, EVADE_MAX]. The player's evasion
 *   (0..EVASION_CAP) already is powered engines x pilot skill, which is the engines and the helm; it is read from the ship's combat state (from the packet in hyperspace).
 * - bribe = BRIBE_PER_STRENGTH x strength x (1 + danger x BRIBE_PER_DANGER) x (1 - BRIBE_STANDING x standing with the faction, clamped to [0.5, 2]),
 *   rounded, at least BRIBE_MIN. A faction that likes you asks less; one that hates you asks more.
 */
export const fleetStrength = (ships: readonly Contact[]): number => ships.reduce((n, c) => n + 1 + c.depth * STRENGTH_PER_DEPTH, 0);

/** The player's evasion, 0 when there is no ship. */
export function playerEvasion(sim: Sim): number {
  const p = sim.sector.packet;
  if (sim.sector.state === 'hyperspace' && p) return (p.entities.find((e) => e.id === p.ship)?.c['combat'] as { evasion?: number } | undefined)?.evasion ?? 0;
  const me = playerShipInfo(sim);
  return me ? sim.world.get(me.id, CombatC)?.evasion ?? 0 : 0;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Chance (0..1) an evade roll succeeds against this encounter's fleet. */
export function evadeOdds(sim: Sim, e: Encounter): number {
  const p = EVADE_BASE + playerEvasion(sim) * EVADE_PER_EVASION - e.strength * EVADE_PER_STRENGTH;
  return Math.round(clamp(p, EVADE_MIN, EVADE_MAX) * 1000) / 1000;
}

/** Credits the fleet asks to let the player pass. */
export function bribeCost(sim: Sim, e: Encounter): number {
  const mod = clamp(1 - BRIBE_STANDING * standing(sim, e.faction), 0.5, 2);
  return Math.max(BRIBE_MIN, Math.round(BRIBE_PER_STRENGTH * e.strength * (1 + e.danger * BRIBE_PER_DANGER) * mod));
}
