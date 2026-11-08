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
/**
 * Inspections (#138): a station sends INSPECTORS of INSPECTOR_ROLE by shuttle; each search takes INSPECT_SEARCH_SEC at work speed 1. They take contraband
 * off player crew and floors within INSPECT_SPOT_TILES of them. A bribe is taken with INSPECT_BRIBE_CHANCE; turned down, it costs SCAN_STANDING_HIT and
 * is not offered again. Refusing costs INSPECT_REFUSE_HIT and the station's service for INSPECT_BAN_TURNS turns. A party that has not boarded after INSPECT_BOARD_SEC, or whose
 * searches nobody has taken for INSPECT_STALL_SEC, is blocked (the alert); one not home INSPECT_HOME_SEC after leaving is ended.
 */
export const INSPECTORS = 2;
export const INSPECTOR_ROLE = 'role.security';
export const INSPECT_SEARCH_SEC = 5;
export const INSPECT_SPOT_TILES = 2;
export const INSPECT_BRIBE_CHANCE = 0.6;
export const INSPECT_REFUSE_HIT = 4;
/** Galaxy turns a station that was refused (or run from) will not deal with the player. */
export const INSPECT_BAN_TURNS = 10;
export const INSPECT_BOARD_SEC = 90;
export const INSPECT_STALL_SEC = 45;
export const INSPECT_HOME_SEC = 300;
/**
 * Refusing and fighting (#138 step 3): a refused patrol turns hostile once its inspectors are off the player's ship, or INSPECT_TURN_SEC after they set
 * off home. Attacking the inspectors costs INSPECT_FIGHT_HIT standing and turns their side hostile; a station also refuses service for INSPECT_FIGHT_BAN_TURNS.
 */
export const INSPECT_TURN_SEC = 10;
export const INSPECT_FIGHT_HIT = 10;
export const INSPECT_FIGHT_BAN_TURNS = 30;
/**
 * Patrol hails (#138 step 2): a patrol whose scan reads contraband hails the player to stop. Running costs PATROL_RUN_HIT standing, and with
 * PATROL_CHASE_CHANCE (a seeded roll) the patrol gives chase for PATROL_CHASE_TURNS turns (the hunters' path), hailing again if it catches them.
 */
export const PATROL_RUN_HIT = 3;
export const PATROL_CHASE_CHANCE = 0.5;
export const PATROL_CHASE_TURNS = 4;
