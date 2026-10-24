/**
 * Heat: the player's notoriety and the hunters it brings (user decisions 2026-10-24, issue #52). Danger itself never scales with the player's ship:
 * distance sets the baseline (`dangerAt`), notoriety is what the player has done, and faction standing decides who comes for them.
 *
 * Notoriety is one number. Destroying or capturing a ship adds KILL_NOTORIETY by the victim faction's tier before the kill (a hostile ship that attacked
 * is almost free, a friendly one is piracy), a station adds STATION_NOTORIETY, and each costs the victim faction KILL_REPUTATION. Every turn it decays by
 * NOTORIETY_DECAY of itself (at least NOTORIETY_DECAY_MIN). At a pirate den it can be paid off for CLEAR_COST_PER_POINT credits a point.
 * From WANTED_AT the law (LAW_KINDS) treats the player as hostile.
 */
export const KILL_NOTORIETY = { friendly: 8, neutral: 5, hostile: 1 } as const;
export const STATION_NOTORIETY = 15;
/** Capturing a ship counts this many times a kill. */
export const CAPTURE_FACTOR = 1.5;
export const KILL_REPUTATION = 1;
export const NOTORIETY_DECAY = 0.01;
export const NOTORIETY_DECAY_MIN = 0.05;
export const NOTORIETY_MAX = 100;
export const WANTED_AT = 10;
export const LAW_KINDS: readonly string[] = ['government'];
export const CLEAR_COST_PER_POINT = 60;

/**
 * Hunters. Each turn, a faction that may hunt the player (hostile to them, or the law while they are wanted) and has a port within HUNT_RANGE jumps
 * dispatches a hunter fleet with chance min(HUNT_MAX_CHANCE, HUNT_PER_PRESSURE x pressure), at most once per HUNT_COOLDOWN turns, while fewer than
 * MAX_HUNTERS hunt. Pressure = GRUDGE_WEIGHT x grudge + (the law only) NOTORIETY_WEIGHT x (notoriety - WANTED_AT), where grudge is the reputation the
 * player has lost with the faction (a base standing does not count: pirates are hostile from the start but only hunt once you have hurt them).
 * A hunter's budget is HUNT_BUDGET_BASE + HUNT_BUDGET_PER_PRESSURE x pressure (at most HUNT_BUDGET_MAX), up to 1 + pressure / HUNT_SHIPS_PER ships
 * (at most HUNT_SHIPS_MAX). It follows the player for HUNT_TURNS turns, then goes home and stands down.
 */
export const HUNT_RANGE = 6;
export const HUNT_PER_PRESSURE = 0.04;
export const HUNT_MAX_CHANCE = 0.35;
export const HUNT_COOLDOWN = 8;
export const MAX_HUNTERS = 2;
export const GRUDGE_WEIGHT = 1;
export const NOTORIETY_WEIGHT = 0.3;
export const HUNT_BUDGET_BASE = 2;
export const HUNT_BUDGET_PER_PRESSURE = 0.5;
export const HUNT_BUDGET_MAX = 12;
export const HUNT_SHIPS_PER = 4;
export const HUNT_SHIPS_MAX = 4;
export const HUNT_TURNS = 15;

/**
 * The start-area floor (#45): nodes up to SCAVENGER_MAX_DANGER, where the traffic pool holds nobody hostile, still see a lone scavenger of
 * SCAVENGER_FACTION jump in with chance SCAVENGER_CHANCE per arrival roll.
 */
export const SCAVENGER_FACTION = 'pirates';
export const SCAVENGER_MAX_DANGER = 1;
export const SCAVENGER_CHANCE = 0.06;
