/** Tuning of the gas solver (systems/atmosphere.ts): gases in kPa, one tile one unit volume. Split from tuning.ts (#65). */

/** Explicit diffusion substeps per tick. */
export const GAS_SUBSTEPS = 2;
/**
 * Gas solves every GAS_EVERY ticks per ship, on a phase per ship, running those ticks in turn inside one solve (#65): each tick's life
 * support, then its GAS_SUBSTEPS substeps. The same diffusion, while the per-solve work (loading the fields, the frame, the write-back) is
 * done a quarter as often. Gas that crew, fire or an airlock add or take in between spreads at the next solve.
 */
export const GAS_EVERY = 4;
/** Fraction of the pressure difference moved per substep across a fully open link (stable at <= 0.25). */
export const GAS_DIFFUSION = 0.2;
/** Same, for a link into Space (a breach). */
export const GAS_VENT = 0.25;
/** Writes smaller than this are skipped so idle rooms don't churn field revisions. */
export const GAS_EPSILON = 1e-4;
