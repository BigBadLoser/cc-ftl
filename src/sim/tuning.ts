/**
 * Every gameplay tuning constant for the ship-systems simulation, in one place.
 * Units: gases in kPa (one tile = one unit volume), temperature in degrees C, time in seconds
 * unless the name says PER_TICK. The sim runs at 20 ticks per second.
 */

// --- Atmosphere ---
export const NORMAL_O2 = 21;
export const NORMAL_CO2 = 0.04;
export const NORMAL_TEMP = 20;
/** Space is a fixed sink; clamped to a gameplay-sane floor rather than 3 K. */
export const SPACE_TEMP = -100;
/** Explicit diffusion substeps per tick. */
export const GAS_SUBSTEPS = 2;
/** Fraction of the pressure difference moved per substep across a fully open link (stable at <= 0.25). */
export const GAS_DIFFUSION = 0.2;
/** Same, for a link into Space (a breach). */
export const GAS_VENT = 0.25;
/** Writes smaller than this are skipped so idle rooms don't churn field revisions. */
export const GAS_EPSILON = 1e-4;

// --- Temperature ---
export const TEMP_DIFFUSION = 0.04;
export const TEMP_VENT = 0.02;
/** Passive radiators: fraction of (temp - NORMAL_TEMP) lost per tick. */
export const TEMP_AMBIENT_LOSS = 0.0008;

// --- Smoke ---
export const SMOKE_DIFFUSION = 0.12;
export const SMOKE_VENT = 0.25;
/** Smoke removed from every smoky tile once per second. */
export const SMOKE_DECAY_PER_SEC = 3;

// --- Fire ---
/** Fire needs this much oxygen to burn; below it intensity collapses. */
export const FIRE_MIN_O2 = 12;
export const FIRE_START_INTENSITY = 40;
/** Bare floor fuel. Modules use their own flammability when higher. */
export const FLOOR_FLAMMABILITY = 0.15;
export const FIRE_GROWTH_PER_SEC = 40;
export const FIRE_DECAY_PER_SEC = 5;
export const FIRE_STARVE_PER_SEC = 60;
/** Per neighbour per second at full intensity, scaled by fuel and oxygen. */
export const FIRE_SPREAD_PER_SEC = 1.2;
/** At full intensity, per second. */
export const FIRE_O2_USE = 3;
export const FIRE_CO2_MAKE = 1.5;
export const FIRE_HEAT = 60;
export const FIRE_SMOKE = 80;
export const FIRE_MODULE_DAMAGE = 8;

// --- Modules / power ---
export const DEFAULT_PRIORITY = 3;
export const LIGHT_DARK_BELOW = 40;
/** Light falloff: level is scaled by (1 - FALLOFF * dist / radius). */
export const LIGHT_FALLOFF = 0.55;
/** Door openness lost per tick once nobody is in the doorway (closes in ~3 s). */
export const DOOR_CLOSE_PER_TICK = 4;
/** Hp repaired per second at workSpeed 1. */
export const REPAIR_PER_SEC = 3;
/** Fire intensity removed per second at workSpeed 1. */
export const EXTINGUISH_PER_SEC = 90;

// --- Crew vitals ---
export const CREW_MAX_HP = 100;
export const BREATH_O2_PER_SEC = 0.05;
export const BREATH_CO2_PER_SEC = 0.05;
export const O2_HARM_BELOW = 10;
export const O2_HARM_PER_SEC = 0.4;
export const CO2_HARM_ABOVE = 5;
export const CO2_HARM_PER_SEC = 0.6;
export const HOT_ABOVE = 55;
export const COLD_BELOW = -10;
export const TEMP_HARM_PER_SEC = 0.15;
export const FIRE_CREW_DAMAGE = 8;
/** Seconds a downed, unrescued crew member lasts. */
export const BLEED_OUT_SECONDS = 120;
/** Hp per second regained in a bed while stabilized. */
export const BED_HEAL_PER_SEC = 1.5;
/** Stabilized crew get up at this hp. */
export const GET_UP_HP = 40;
/** Hp per second regained by upright crew in safe air. */
export const REGEN_PER_SEC = 0.1;
/** Sleeping in a bed recovers rest this much faster than sleeping on the floor. */
export const BED_REST_MULT = 2;

// --- Stat conditions ---
export const O2_LOW_WORK_BELOW = 16;
export const DARK_MOVE_MULT = 0.8;
export const DARK_WORK_MULT = 0.7;
export const LOW_O2_WORK_MULT = 0.8;

// --- Alerts ---
export const ALERT_INTERVAL_TICKS = 5;
export const O2_ALERT_BELOW = 16;
export const O2_ALERT_CLEAR_ABOVE = 18;

// --- Economy ---
/** Units a crew member carries at once when the species does not say. */
export const DEFAULT_CARRY_CAPACITY = 50;
/** Fraction (rounded down) of a build cost refunded when deconstructing. */
export const DECON_REFUND = 0.5;
/** Planners (supply, hauling, crafting) run once per this many ticks. */
export const PLAN_INTERVAL = 10;
/** Minimum ticks between repeats of the same 'job.missingMaterials' / 'storage.full' warning. */
export const WARN_DEBOUNCE = 400;
/** Units per second a stack burns at flammability 1 on a fully burning tile. */
export const ITEM_BURN_PER_SEC = 6;
// --- Combat ---
export const SECTOR_WIDTH = 200;
export const SECTOR_HEIGHT = 120;
/** Where the player's ship sits in a new sector (top-left tile). */
export const PLAYER_START = { x: 20, y: 50 } as const;
/** Seconds of piloted, powered engines to charge the FTL drive. */
export const FTL_CHARGE_SEC = 40;
/** Evasion never exceeds this. */
export const EVASION_CAP = 0.75;
/** Each skill level multiplies the effect by (1 + this). */
export const SKILL_STEP = 0.1;
/** Aim sigma shrinks by this per gunnery level (floor at MIN_SPREAD_FACTOR). */
export const SPREAD_PER_GUNNERY = 0.12;
export const MIN_SPREAD_FACTOR = 0.3;
/** Shield recharge speed bonus with an operator at the shield console (plus SKILL_STEP per shielding level). */
export const SHIELD_OPERATED_BONUS = 0.5;
/** Point-defence chance per AI core tier against each interceptable shot (cap PD_CAP). */
export const PD_CHANCE_PER_TIER = 0.35;
export const PD_CAP = 0.9;
/** Point defence rolls once a shot is this far along its flight. */
export const PD_WINDOW = 0.6;
/** Hull integrity below which a ship is a wreck / below which the AI tries to flee. */
export const WRECK_BELOW = 0.15;
export const FLEE_BELOW = 0.3;
/** Ticks between ship-state and AI re-evaluations. */
export const SHIP_STATE_INTERVAL = 10;
export const AI_RETARGET_TICKS = 40;
/** Fire intensity set by incendiary hits. */
export const IGNITE_INTENSITY = 90;
/** Crew with operating priority at or below this level (1 or 2) will man consoles on their own. */
export const OPERATE_MAX_LEVEL = 2;
/** Operators keep manning their console until rest drops below this. */
export const OPERATOR_EXHAUSTED_BELOW = 5;
/**
 * Deployable roof parts gate gameplay: weapons cannot charge or fire, shields cannot come up or regenerate and
 * point defence cannot roll until the part is fully deployed. Set false to keep the animation but drop the gating.
 */
export const DEPLOY_GATES_ACTIONS = true;
