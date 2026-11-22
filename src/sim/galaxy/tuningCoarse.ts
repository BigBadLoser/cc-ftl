/**
 * The coarse tier (coarse.ts): the far galaxy keeps living. Every COARSE_TURNS turns, territory is re-weighed at the fronts (lane-adjacent sectors held by
 * factions at war), pressure builds on the weaker side and, after FLIP_TICKS ticks in a row over the threshold, a sector changes hands. Rolls are hashed on
 * (seed, sector, tick index). See docs/plans/far-galaxy-604.md.
 */

/** A coarse tick runs on every turn that is a multiple of this (about 24 minutes at 1x, or 8 jumps). */
export const COARSE_TURNS = 8;
/** A sector flips only after its pressure has stayed over FLIP_THRESHOLD this many coarse ticks in a row (so nothing changes between two quick looks). */
export const FLIP_TICKS = 3;
/** A sector that just changed hands cannot change again for this many coarse ticks (no flip-flopping). */
export const FLIP_COOLDOWN = 4;
/**
 * At most this many sectors change hands per coarse tick, galaxy-wide (strongest pressure first), and never two within FLIP_SPACING lanes of each other
 * (about the player's 9-hop region), so a player looking twice in a row never sees two changes nearby.
 */
export const FLIPS_PER_TICK = 6;
export const FLIP_SPACING = 6;
/** Pressure value a sector must hold to count towards a flip, and the most it can build up. */
export const FLIP_THRESHOLD = 1;
export const PRESSURE_MAX = 2.5;

/** A sector's weight in a faction's strength: a base, plus a hub bonus, plus per station it owns there; each ship its ports still owe takes OWED_WEIGHT off. */
export const SECTOR_BASE = 1;
export const SECTOR_HUB = 1;
export const SECTOR_PORT = 0.5;
export const OWED_WEIGHT = 0.4;
/** A faction's strength at a front counts its own sectors within STRENGTH_LANES lanes, each weighted by FALLOFF[lanes away] (a sector of the front itself counts fully). */
export const STRENGTH_LANES = 2;
export const FALLOFF: readonly number[] = [1, 0.6, 0.3];
/** The defender's edge at home. Pirates raid rather than hold: they hit harder than they hold, and a pirate flip needs a higher threshold. */
export const DEFENDER_EDGE = 1.0;
export const PIRATE_RAID = 1.25;
export const PIRATE_HOLD = 0.6;
export const PIRATE_FLIP_MULT = 1.5;

/** Pressure added per tick at a full share of the front's strength (share = (attack - defence) / (attack + defence), above 0), and the hashed swing around it (+-). */
export const PUSH_RATE = 1.2;
export const PUSH_SWING = 0.5;
/** A push that continues keeps this much of the old pressure; with no push it decays by DECAY and is dropped under PRESSURE_EPS. */
export const PRESSURE_KEEP = 0.85;
export const PRESSURE_DECAY = 0.5;
export const PRESSURE_EPS = 0.08;

/** Protected: a faction keeps at least this many of the generated sectors (no eliminations). The start sector and every cluster hub never flip. */
export const FACTION_MIN_SECTORS = 3;

/** A fleet of the old owner homed at a flipped port looks for another port of its faction this many hops away, else it is disbanded. */
export const REHOME_HOPS = 6;

/** Summary news outside the fleet area: at most this many front/held items per coarse tick; `front` when a push starts and `held` when a long push fades. */
export const NEWS_PER_TICK = 1;
/** Pressure (as a share of the threshold) a sector must have reached for its fading to read as "held". */
export const HELD_SHARE = 0.6;

/** Expansion: what an unowned sector counts as defence at a claim, and how much slower than a war push a claim builds. */
export const UNOWNED_DEFENCE = 0.5;
export const EXPAND_RATE = 1;
