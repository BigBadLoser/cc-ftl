/**
 * Combat heat: every tuning number in one place (see heat.ts for the rules). Per-weapon heat lives on the weapon defs in
 * content (`WeaponDef.heat`), and a radiator's cooling on its module def (`ModuleDef.radiator`).
 */

/** Heat at which a ship overheats. Heat runs 0..HEAT_MAX. */
export const HEAT_MAX = 100;

// --- Sources ---
/** Heat added for each shield layer a hit absorbs (a shot that takes 2 layers adds twice this; ion drain counts). */
export const HEAT_PER_LAYER = 3;

// --- Shields ---
/**
 * Shield regeneration speed multiplier for every ship (1.4: a Mk I layer returns in about 7 s instead of 10). With heat that only falls while the
 * shields are down, shields that hold a bit longer are what makes the heat bite: the ship has to choose when to drop them or vent.
 */
export const SHIELD_REGEN_MULT = 1.4;

// --- Cooling: heat only falls while the shields are down (0 layers, unpowered or disabled generators included) ---
/** Heat per second shed while the shields are down, before radiators. */
// Slow on purpose: holding the shields up runs the ship hot, so dropping them (or venting) is a choice.
export const PASSIVE_COOL_PER_SEC = 2;
/** Out of combat the hull sheds heat at this rate whatever the shields do, so a new fight starts cool. */
export const IDLE_COOL_PER_SEC = 10;
/** A radiator's `coolPerSec` also counts towards a vent at this fraction. */
export const RADIATOR_VENT_FACTOR = 0.5;

// --- Vent (combat.vent) ---
/** Seconds a vent lasts: shields drop and the weapons hold fire. Shields then regenerate normally from zero. */
export const VENT_SEC = 3.5;
/** Heat dumped per second while venting (3.5 s clears a whole meter). */
export const VENT_COOL_PER_SEC = 30;
/** A vent below this heat is refused (nothing to dump). */
export const VENT_MIN_HEAT = 15;
/** Vent speed bonus (fraction) when an engineer mans a coolant console. No coolant console exists yet: see `coolantOperator`. */
export const VENT_OPERATED_BONUS = 0.5;

// --- Overheat ---
/** Seconds of lockout at max heat: weapons cannot charge or fire, the shields drop and stay down. */
export const LOCKOUT_SEC = 8;
/** Heat is clamped to this when the lockout ends (passive cooling alone brings it to about here) so the ship does not relock at once. */
export const LOCKOUT_EXIT_HEAT = 50;

// --- Overcharge (combat.overcharge) ---
/** Seconds an overcharge lasts. */
export const OVERCHARGE_SEC = 5;
/** Seconds from activation until the same system can be overcharged again. */
export const OVERCHARGE_COOLDOWN_SEC = 40;
/** Heat per second while a system is overcharged. */
export const OVERCHARGE_HEAT_PER_SEC = { weapons: 3, shields: 2, engines: 2 } as const;
/** Weapons overcharge: charge speed multiplier. */
export const OVERCHARGE_WEAPON_CHARGE = 1.3;
/** Shields overcharge: recharge speed multiplier (layers return faster; the maximum does not change). */
export const OVERCHARGE_SHIELD_REGEN = 3;
/** Engines overcharge: added to evasion (still capped by EVASION_CAP; needs a pilot, as evasion does). */
export const OVERCHARGE_ENGINE_EVASION = 0.15;

// --- Enemy AI heat behaviour (the player's ship never does any of this on its own) ---
/** Enemy auto-fire holds a volley that would take heat above this fraction of HEAT_MAX. */
export const AUTO_FIRE_CEILING = 0.95;
/** Vent at this fraction of HEAT_MAX when no foe shot is about to land. */
export const AUTO_VENT_AT = 0.7;
/** Vent at this fraction whatever is incoming: a lockout is worse than a vent with shots in the air. */
export const AUTO_VENT_FORCE_AT = 0.9;
/** A foe weapon charged to this fraction counts as a shot about to land. */
export const AUTO_SHOT_SOON_CHARGE = 0.85;
/** The AI overcharges the weapons while heat is below this fraction of HEAT_MAX. */
export const AI_OVERCHARGE_BELOW = 0.2;
