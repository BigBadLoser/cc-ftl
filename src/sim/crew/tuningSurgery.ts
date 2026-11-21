/** Surgery and implant numbers (DESIGN.md "Injuries and cyberware", #311). First pass; the implants' own numbers are content (content/implants.ts). */

/** Implant load (summed cyber points) at which a crew member counts as heavily augmented (the zealots' rule, trade/augmentation.ts). */
export const HEAVY_LOAD = 6;
/** Success chance of an operation before skill and difficulty, and what each Medicine level adds. */
export const SURGERY_BASE_CHANCE = 0.6;
export const SURGERY_CHANCE_PER_LEVEL = 0.04;
/** Taken off the chance at a medical bed instead of a surgery table. */
export const SURGERY_BED_PENALTY = 0.2;
/** Taken off the chance per implant tier above Mk I (fitting and removing). */
export const SURGERY_TIER_DIFFICULTY = 0.08;
/** Difficulty of the other operations, and of an urgent replacement on a dying patient. */
export const SURGERY_REPAIR_DIFFICULTY = 0.05;
export const SURGERY_URGENT_DIFFICULTY = 0.05;
/** The chance never leaves this range. */
export const SURGERY_CHANCE_MIN = 0.05;
export const SURGERY_CHANCE_MAX = 0.97;
/** Share of failures that are botched (the part destroyed): at a table, and at a medical bed. */
export const SURGERY_BOTCH_SHARE = 0.25;
export const SURGERY_BED_BOTCH_SHARE = 0.4;
/** Seconds of a surgeon's work (at work speed 1): fitting (plus per tier above Mk I), removing, repairing, amputating, and an urgent replacement. */
export const SURGERY_FIT_SEC = 30;
export const SURGERY_FIT_TIER_SEC = 10;
export const SURGERY_REMOVE_SEC = 20;
export const SURGERY_REPAIR_SEC = 30;
export const SURGERY_AMPUTATE_SEC = 20;
export const SURGERY_URGENT_SEC = 15;
/** How often (ticks) the surgery planner looks at the queues and the jobs. */
export const SURGERY_STEP_TICKS = 10;
