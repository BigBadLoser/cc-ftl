/** Crew injury numbers (DESIGN.md "Injuries and cyberware", #601). First pass; the per-kind and per-source numbers are content (content/injuries.ts). */

/** Consciousness below this knocks the crew member out (downed). */
export const KNOCKOUT_BELOW = 0.3;
/** Bleed-out time at no blood pumping, as a share of the normal (it scales up to 1 at full pumping). */
export const BLEED_OUT_MIN_MULT = 0.4;
/** Healing speed (hp regeneration, bed healing, injuries) at no blood pumping, as a share of the normal. */
export const HEAL_MIN_MULT = 0.5;
/** Suit air time at no breathing, as a share of the normal. */
export const SUIT_AIR_MIN_MULT = 0.5;
/** Seconds after which an untreated serious injury may set as a scar, and the chance each time it comes round. */
export const SCAR_AFTER_SEC = 600;
export const SCAR_CHANCE = 0.5;
/** Seconds of a medic's treatment (at care 1) to treat one serious injury at a medical bed. */
export const TREAT_SEC = 15;
/** Medicine XP for treating one serious injury. */
export const TREAT_XP = 4;
/** How much faster treated injuries heal in a powered recovery pod. */
export const POD_INJURY_HEAL_MULT = 2;
/** Seconds of work (at work speed 1) for first aid: the bleeding stops. */
export const FIRST_AID_SEC = 4;
/** How often (ticks) injuries are aged and healed, and bleeding is dealt. */
export const INJURY_STEP_TICKS = 10;
/** Seconds a walking patient waits in a medical bed for a medic to start treating them before they get up (they do not seek treatment again for `STRANDED_RETRY_SEC`). */
export const STRANDED_SEC = 180;
export const STRANDED_RETRY_SEC = 600;
/** Bleeding at this many hp a second or more is "fast" (the Health tab). */
export const BLEED_FAST_AT = 0.3;
/** The `health` drive input (per mille) while a serious injury waits for treatment: under the recover drive's enter (700, content/policies.ts). */
export const TREATMENT_HEALTH_INPUT = 690;
