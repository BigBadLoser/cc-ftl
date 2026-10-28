/**
 * Black-market numbers (user decisions in docs/DESIGN.md "Black markets"; the figures are provisional and listed in the PR for review).
 *
 * Scans: a navy or corporation station scans the player when they open trade with it (once per SCAN_COOLDOWN turns per node); a patrol that crosses
 * the player already scans with the usual PASSING_ENCOUNTER_CHANCE (encounters.ts). If contraband worth V credits (its base prices) is aboard, the player
 * chooses: surrender it and pay a fine of max(SCAN_FINE_MIN, SCAN_FINE_SHARE x V) with a SCAN_STANDING_HIT standing hit, or pay a bribe of
 * max(SCAN_BRIBE_MIN, SCAN_BRIBE_SHARE x V) and keep it. A bribe costs more credits than the fine but keeps the goods and the standing.
 *
 * Truce: a breach (firing on or boarding anyone at a truce node) bans the player for BAN_TURNS turns and costs BREACH_STANDING with every pirate faction.
 *
 */
export const SCAN_COOLDOWN = 6;
export const SCAN_FINE_SHARE = 0.4;
export const SCAN_FINE_MIN = 40;
export const SCAN_BRIBE_SHARE = 0.9;
export const SCAN_BRIBE_MIN = 80;
export const SCAN_STANDING_HIT = 2;
export const BAN_TURNS = 30;
export const BREACH_STANDING = 3;
/** Loot taken off a captured ship: one unit of looted goods per LOOT_PER_VALUE of hull value, between LOOT_MIN and LOOT_MAX. */
export const LOOT_PER_VALUE = 60;
export const LOOT_MIN = 2;
export const LOOT_MAX = 12;
/** Danger tier from which an unowned station in a trade sector counts as lawless (pirate-held stations always do). */
export const LAWLESS_DANGER = 7;
/** Share of pirate-held and lawless stations that are black markets (a seeded roll per station); the others attack on sight. */
export const LESSER_SHARE = 0.25;
