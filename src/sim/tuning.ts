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
export const DEFAULT_POWER_PRIORITY = 3;
export const LIGHT_DARK_BELOW = 40;
/** Light falloff: level is scaled by (1 - FALLOFF * dist / radius). */
export const LIGHT_FALLOFF = 0.55;
/** A wreck's lights run on emergency power: their level is scaled by this (a wreck with no power has none). */
export const WRECK_LIGHT_SCALE = 0.35;
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
/** Bed healing is SKILL_STEP faster per medicine level of the best conscious medic aboard the patient's ship. */
/** Stabilized crew get up at this hp. */
export const GET_UP_HP = 40;
/** Hp per second regained by upright crew in safe air. */
export const REGEN_PER_SEC = 0.1;
/** Sleeping in a bed recovers rest this much faster than sleeping on the floor. */
export const BED_REST_MULT = 2;

// --- Hunger and mood ---
/** Hungry crew (not drafted, not mid-job unless operating) go and eat below this hunger (0..100, 100 = fed). */
export const HUNGER_EAT_BELOW = 35;
/** Operators of a console keep their post until hunger is this low. */
export const HUNGER_EAT_URGENT = 10;
/** Seconds a meal takes once the crew member is at the galley or the crate. */
export const EAT_SEC = 4;
/** Hp per second lost at zero hunger. Slow: a full-health crew member lasts about 33 minutes. */
export const STARVE_HARM_PER_SEC = 0.05;
/** Hunger decays at this fraction of the normal rate while asleep. */
export const HUNGER_SLEEP_MULT = 0.5;
/** Mood is 0..100 from a neutral base plus named factors. */
export const MOOD_BASE = 50;
/** Ticks between mood recomputes per crew member (staggered by id). */
export const MOOD_INTERVAL = 10;
/** Below this mood work slows (x MOOD_LOW_WORK_MULT); below MOOD_VERY_LOW it slows more and an alert fires. */
export const MOOD_LOW = 35;
export const MOOD_VERY_LOW = 20;
export const MOOD_LOW_WORK_MULT = 0.85;
export const MOOD_VERY_LOW_WORK_MULT = 0.7;
/** Open question hook: mood below this makes a crew member a breakdown risk (nothing happens yet, see crew/mood.ts). */
export const MOOD_BREAKDOWN_BELOW = 10;
/** Seconds a hot galley meal, a night in a bed or a night on the floor keeps affecting mood. */
export const MOOD_MEAL_SEC = 300;
export const MOOD_SLEEP_SEC = 600;
/** Another living crew member within this many tiles counts as company; alone this many seconds is lonely. */
export const MOOD_COMPANY_RADIUS = 7;
export const MOOD_LONELY_SEC = 120;

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
/** Tiles a region's frame reaches beyond its bbox: the EVA ring plus one tile of vacuum for venting. */
export const REGION_PAD = 2;
/** Least gap in tiles between two ships' padded frames (ships are never close: user rule). */
export const MIN_SHIP_GAP = 12;
/**
 * Least gap in tiles between asteroid rock (each rock body's bbox) and a ship's padded frame or another asteroid's rock. Smaller
 * than MIN_SHIP_GAP: rock is inert, and mining pods should not fly far.
 */
export const ASTEROID_GAP = 4;
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
/** Each working point-defence module gets its own roll at this chance against each interceptable shot. */
export const PD_CHANCE = 0.35;
/** Point defence rolls once a shot is this far along its flight. */
export const PD_WINDOW = 0.6;
/** Hull integrity below which a ship is a wreck / below which the AI tries to flee. */
export const WRECK_BELOW = 0.15;
export const FLEE_BELOW = 0.3;
/** Ticks between ship-state and AI re-evaluations. */
export const SHIP_STATE_INTERVAL = 10;
export const AI_RETARGET_TICKS = 40;
/** Hull hits a ship remembers for the damage art (`HullHitsC`): the oldest goes when a new one lands past this. */
export const HULL_HITS_MAX = 64;
/** Battle wear (`wear` field, 0..255) a tile gains per point of hull damage landing on it (walls, floors and roofs alike). */
export const WEAR_PER_HULL_DAMAGE = 0.25;
/** Fire intensity set by incendiary hits. */
export const IGNITE_INTENSITY = 90;
/** Crew with operating priority at or below this level (1 or 2) will man consoles on their own. */
export const OPERATE_MAX_LEVEL = 2;
/** In a fight, a console nobody has held for this long is relieved by any idle crew (operating priority above OPERATE_MAX_LEVEL, but not disabled). */
export const RELIEF_AFTER_SEC = 12;
/** Path-score penalty on a relieved console (longer than any walk), so other work of the same rank comes first. */
export const RELIEF_PENALTY = 1000;
/** Operators keep manning their console until rest drops below this. */
export const OPERATOR_EXHAUSTED_BELOW = 5;
/**
 * Deployable roof parts gate gameplay: weapons cannot charge or fire, shields cannot come up or regenerate and
 * point defence cannot roll until the part is fully deployed. Set false to keep the animation but drop the gating.
 */
export const DEPLOY_GATES_ACTIONS = true;

// --- Vehicles ---
/** Point defence engages hostile shuttles within this many sector tiles of the defending ship's centre. */
export const VEHICLE_PD_RANGE = 45;
/** Ticks between a point-defence module's rolls against a shuttle. */
export const VEHICLE_PD_INTERVAL = 10;
/** Chance per roll, and hp taken on a hit. */
export const VEHICLE_PD_CHANCE = 0.35;
export const VEHICLE_PD_DAMAGE = 10;
/** Point defence never takes a shuttle below this fraction of its max hp: it chips, only anti-vehicle weapons kill. */
export const VEHICLE_PD_FLOOR = 0.3;
/** Player anti-vehicle weapons engage a hostile shuttle in flight within this many tiles of the ship centre (or one heading for it at any range). */
export const ANTI_VEHICLE_RANGE = 70;
/** Boarding parties never leave the ship with fewer than this many crew aboard. */
export const BOARDING_MIN_HOME = 1;
/** Ticks the boarding AI waits for its party to reach the bay before it launches with whoever is aboard. */
export const BOARDING_LOAD_TICKS = 600;

/** Zealot core raid (capture/coreRaid.ts): ticks raiders must hold an AI core undisturbed to tear it out, how close they stand, and how close a defender must be to stop them. */
export const CORE_RAID_HOLD_TICKS = 40 * 20;
export const CORE_RAID_RADIUS = 2.5;
export const CORE_RAID_DEFENDER_RADIUS = 5;

// --- Crew combat ---
/** Crew notice hostiles this far away (tiles) when they have line of sight. */
export const COMBAT_SIGHT = 16;
/** Bare hands. */
export const UNARMED = { damage: 5, cooldownSec: 1.2, accuracy: 0.7 } as const;
/** Hit chance added per gunnery / melee level. */
export const ACCURACY_PER_SKILL = 0.05;
/** Ranged hit chance is scaled by (1 - this * distance / range): a shot at maximum range keeps (1 - this). */
export const RANGE_FALLOFF = 0.4;
/** Hit chance multipliers behind partial and full cover. */
export const COVER_PARTIAL_MULT = 0.6;
export const COVER_FULL_MULT = 0.35;
export const HIT_CHANCE_MIN = 0.05;
export const HIT_CHANCE_MAX = 0.95;
/** A door tile at or above this openness (0..255) lets sight through. */
export const DOOR_SIGHT_OPEN = 64;
/** Ticks between flee replans. */
export const FLEE_REPLAN_TICKS = 15;
export const FLEE_RADIUS = 10;
/** An unarmed crew member who is out of every intruder's sight and farther than this (tiles) stays where they are. */
export const FLEE_HOLD_DIST = 5;
/** Ticks between path replans while closing in on a target. */
export const CHASE_REPLAN_TICKS = 6;
/** Surrender: hp fraction under which a non-player crew member gives up when outnumbered within this many tiles. */
export const SURRENDER_HP_FRAC = 0.3;
export const SURRENDER_RADIUS = 12;

// --- Capture ---
/** Default seconds player-side crew must hold a ship's bridge, unopposed, to capture it. A bridge module's `bridge.holdSec` overrides. */
export const CAPTURE_HOLD_SEC = 6;
/** Default reach (tiles, Chebyshev) from a bridge module's access tile that counts as holding it. `bridge.radius` overrides. */
export const CAPTURE_BRIDGE_RADIUS = 2;
/** Prize value estimate (future ship broker): credits per unit of module build cost, scaled by module hp fraction. */
export const PRIZE_VALUE_PER_COST = 10;
/** Prize value per point of wall/door integrity. */
export const PRIZE_VALUE_PER_WALL_HP = 0.05;

// --- Robots ---
/** Ion that reaches the deck (no shield layer drained) stuns ion-vulnerable crew this many tiles (Chebyshev) from the hit. */
export const ION_STUN_RADIUS = 1;
/** Hp per second a mender restores on a robot at workSpeed 1, plus SKILL_STEP per repair level. */
export const MEND_PER_SEC = 4;
/** Seconds of work to strip a robot wreck for parts. */
export const SALVAGE_SEC = 4;
/** Seconds to hack an AI core at hacking level 1 (each level above is SKILL_STEP faster). */
export const HACK_SEC = 20;
/** Stat multiplier on moveSpeed and workSpeed of a robot whose battery is empty. */
export const EMPTY_CHARGE_MULT = 0.3;
/** A robot heads for its bay to be repaired below this hp fraction (when the ship has repair items). */
export const BAY_REPAIR_BELOW = 0.5;
/** Hold: a hacker keeps a hacked core while within this many tiles (Chebyshev) of its footprint. */
export const HACK_HOLD_RADIUS = 1;

// --- EVA ---
/** Air (kPa) under which a tile counts as thin: unsuited crew avoid it, a suit's tank is in use there. */
export const EVA_THIN_AIR_BELOW = 8;
/** The suit's warning fires when the tank falls to this fraction. */
export const EVA_AIR_LOW_FRAC = 0.25;
/** The default suit (content/suit.ts overrides it): a tank lasts 4 minutes, donning takes 5 s, a suited crew member is 20% slower. */
export const DEFAULT_SUIT = {
  airSec: 240, donSec: 5, doffSec: 3, moveMult: 0.8, workMult: 0.9, accuracyMult: 0.8, floatSpeed: 1.5, floatRange: 6,
} as const;
/** Extra path steps an automatic job that needs vacuum counts for when crew choose between jobs (they prefer no EVA). */
export const EVA_JOB_PENALTY = 30;

// --- Aliens on derelicts (src/sim/aliens). Placeholder numbers; see docs/STATUS.md "Aliens" for the open questions.
/** Egg sac hp by footprint (1x1, 2x2). */
export const SAC_HP: readonly number[] = [0, 30, 60];
/** A non-alien within this many tiles with a clear line of sight disturbs a dormant sac. */
export const SAC_SENSE = 3;
/** Ticks between proximity checks. */
export const SAC_CHECK_TICKS = 5;
/** Seconds per hatch stage (.hatch0, .hatch1); the alien comes out on .hatch2, which then lasts this long before .burst. */
export const SAC_STAGE_SEC = 1.2;
/** A hatching sac sets off dormant sacs within this many tiles after a random delay of MIN..MAX seconds. */
export const SAC_CHAIN_RADIUS = 6;
export const SAC_CHAIN_MIN_SEC = 1;
export const SAC_CHAIN_MAX_SEC = 3;
/** Fire on a sac's tile hurts it this much per second at full intensity. */
export const SAC_FIRE_DAMAGE = 10;
/** Chance a dormant sac spawns cracked and leaking (a look only). */
export const SAC_LEAK_CHANCE = 0.3;
/** Aliens per hatched sac, by footprint (1x1, 2x2). */
export const SAC_BROOD: readonly number[] = [0, 1, 2];
/** A nest lays a sac every this many seconds while a non-alien is aboard, at most NEST_MAX_SACS, within NEST_RADIUS. */
export const NEST_LAY_SEC = 60;
export const NEST_MAX_SACS = 3;
export const NEST_RADIUS = 4;
/** Idle aliens wander within this many tiles of where they hatched (per-tick chance of a stroll). */
export const ALIEN_ROAM = 4;
export const ALIEN_WANDER_CHANCE = 0.01;
/** Seconds the player's ship must stay clear of intruders before emergency-armed crew put their weapon back in storage. */
export const EMERGENCY_STAND_DOWN_SEC = 30;
