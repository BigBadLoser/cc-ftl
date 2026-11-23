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
/** The roles that carry weapons (the rest only fight when attacked). */
export const ARMED: readonly FleetRole[] = ['patrol', 'pirate', 'raider'];
/** Wrecks a node keeps for the player to find (the oldest are forgotten). */
export const WRECKS_PER_NODE = 4;
/** The news log keeps this many entries (newest last). A port reports a shortage of an item below this share of its baseline (baselines of at least NEWS_SHORTAGE_MIN), at most once per NEWS_SHORTAGE_TURNS. */
export const NEWS_MAX = 40;
export const NEWS_SHORTAGE_SHARE = 0.1;
export const NEWS_SHORTAGE_MIN = 10;
export const NEWS_SHORTAGE_TURNS = 80;
/** Armed fleets hunt: with this chance per planned leg a patrol makes for a pirate (and a pirate for a trader) within its range, if it is at least HUNT_EDGE times as strong. */
export const HUNT_CHANCE = 0.85;
export const HUNT_EDGE = 0.6;

/**
 * Fights between NPC ships in the player's node (#603, galaxy/engagementFlow.ts). A side with no ship real after ENGAGE_WAIT_SEC (no room in the
 * sector, or the opening grace) is settled by the stats fight instead. There is no time limit (user, 2026-11-21): a fight in which no ship has
 * taken damage for ENGAGE_STALE_SEC is a stalemate, and the weaker side jumps away. A ship holding the field under ENGAGE_HURT_INTEGRITY counts
 * its side as hurt (stranded).
 */
export const ENGAGE_WAIT_SEC = 20;
export const ENGAGE_STALE_SEC = 60;
export const ENGAGE_HURT_INTEGRITY = 0.6;
/** Joining a side (firing on or boarding only its foes) earns JOIN_STANDING with its faction, and JOIN_WIN_STANDING more if that side wins; once per fight. */
export const JOIN_STANDING = 2;
export const JOIN_WIN_STANDING = 3;
/** Ships (and armed stations) of a faction the player stands at least AID_STANDING with take on a ship that fires on the player in their node. */
export const AID_STANDING = 3;

/**
 * NPC ships going about their business in the player's node (#603, galaxy/traffic.ts). At most NPC_ACTIVITIES actions run at once (a station shuttle's
 * call, an NPC's mining pod out, a patrol's inspection of an NPC ship). A station's shuttle calls at a visiting trader for TRADE_HOP_SEC, then rests
 * TRADE_HOP_EVERY_SEC before it calls again. A patrol in the node inspects a non-hostile NPC trader or miner in a galaxy turn whose roll passes
 * INSPECT_NPC_CHANCE (one at a time); with INSPECT_NPC_SEIZE (or when the search found contraband) the inspectors seize cargo and the news says so.
 */
export const NPC_ACTIVITIES = 2;
export const TRADE_HOP_SEC = 30;
export const TRADE_HOP_EVERY_SEC = 90;
export const INSPECT_NPC_CHANCE = 0.5;
export const INSPECT_NPC_SEIZE = 0.2;
