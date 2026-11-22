/**
 * Dynamic wars (war.ts): factions that border each other drift into war and out of it, on the coarse tick. Chances are per coarse tick (about 24 minutes at 1x),
 * hashed on (seed, pair, tick). See docs/plans/far-galaxy-604.md.
 */

/** Chance per tick that a pair at peace that borders starts a war: the base, times (1 + FRICTION_GAIN per sector pair along their border (up to FRICTION_CAP) + HEAT_GAIN per unit of recent-fight heat), times RIVAL_MULT for a pair the table lists at war (old rivals). */
export const START_BASE = 0.012;
export const FRICTION_GAIN = 0.35;
export const FRICTION_CAP = 8;
export const HEAT_GAIN = 0.5;
export const RIVAL_MULT = 3;
/** Chance per tick that a war ends: the base plus END_TIRED per point of war weariness, times NO_BORDER_END_MULT when the two no longer border (nothing left to fight over). */
export const END_BASE = 0.008;
export const END_TIRED = 0.01;
export const NO_BORDER_END_MULT = 3;
/** War weariness: per tick at war, per sector lost by either side, per ship lost in a fight between the two. */
export const TIRED_TICK = 0.05;
export const TIRED_FLIP = 1;
export const TIRED_LOSS = 0.05;
/** Friction from fights: per sector lost between the two and per ship lost; it decays by HEAT_DECAY each tick (so a grudge outlasts the war a while). */
export const HEAT_FLIP = 1;
export const HEAT_LOSS = 0.1;
export const HEAT_DECAY = 0.97;
/** A pair does not change stance again for this many ticks after it changed (no churn), and at most this many pairs change per tick galaxy-wide. */
export const STANCE_COOLDOWN = 20;
export const STANCE_PER_TICK = 1;
/** Below this, weariness and heat count as nothing and the pair's entry can go. */
export const STANCE_EPS = 0.01;
