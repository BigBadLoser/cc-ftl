import type { FleetRole, ShipSize } from './defs';

/**
 * Off-screen life (living world stage 4): NPC fleets of hostile factions that meet outside the player's node are settled by a stats mini-sim
 * (clash.ts) - "three heavy navy battleships against one small pirate: the winner is obvious". All rolls are hashed from (seed, fleets, turn).
 *
 * Power of a ship = SHIP_POWER[size] x ROLE_POWER[role] x (1 + DEPTH_POWER x depth); a fleet's is the sum. Haulers and miners carry little armament, so a
 * heavy freighter is about as strong as a small pirate. A side's share p = A / (A + B) after each side's power is scaled by a bounded random factor
 * (1 +- CLASH_NOISE), and the share decides:
 *   p >= WIN_ALL          the loser is destroyed (every ship), the winner is hurt with chance HURT_WINNER x (1 - p)
 *   p >= WIN_DRIVE        the loser is driven off: each ship is lost with chance LOSS_DRIVEN x (p - WIN_DRIVE) / (WIN_ALL - WIN_DRIVE), survivors flee home (hurt)
 *   otherwise (a draw)    both sides are hurt (stranded, calling for help) and each ship is lost with chance LOSS_DRAW
 * Pirates (not drones) avoid a patrol that is much stronger than they are (AVOID_RATIO, chance AVOID_CHANCE): no fight, they run home.
 */
export const SHIP_POWER: Record<ShipSize, number> = { small: 1, medium: 2.4, heavy: 5 };
export const ROLE_POWER: Record<FleetRole, number> = { patrol: 1.25, pirate: 1, raider: 1.1, trader: 0.12, miner: 0.1 };
export const DEPTH_POWER = 0.08;
export const CLASH_NOISE = 0.35;
export const WIN_ALL = 0.82;
export const WIN_DRIVE = 0.62;
export const HURT_WINNER = 1.6;
export const LOSS_DRIVEN = 0.7;
export const LOSS_DRAW = 0.15;
export const AVOID_RATIO = 0.45;
export const AVOID_CHANCE = 0.8;
/** A patrol that drove a pirate off follows it this many hops. */
export const CHASE_HOPS = 2;
/** Relation sum (each way) at or below which two factions fight on sight, and the roles that carry weapons (the rest only fight when attacked). */
export const WAR_RELATION = -0.3;
export const ARMED: readonly FleetRole[] = ['patrol', 'pirate', 'raider'];
/** Wrecks a node keeps for the player to find (the oldest are forgotten). */
export const WRECKS_PER_NODE = 4;
/** The news log keeps this many entries (newest last). A port reports a shortage of an item below this share of its baseline (baselines of at least NEWS_SHORTAGE_MIN), at most once per NEWS_SHORTAGE_TURNS. */
export const NEWS_MAX = 40;
export const NEWS_SHORTAGE_SHARE = 0.1;
export const NEWS_SHORTAGE_MIN = 10;
export const NEWS_SHORTAGE_TURNS = 80;
/** Armed fleets hunt: with this chance per planned leg a patrol makes for a pirate (and a pirate for a trader) within its range, if it is at least HUNT_EDGE times as strong. */
export const HUNT_CHANCE = 0.6;
export const HUNT_EDGE = 0.8;
