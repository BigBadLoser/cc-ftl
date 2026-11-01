/**
 * Station jobs (missions v1, issue #52): deliveries, bounties and surveys offered at stations, depots and dens (jobs.ts, jobOffers.ts).
 *
 * Offers are a pure function of (seed, port, OFFER_TURNS window), so they cost nothing to save: up to OFFERS_PER_PORT per port. The station type decides
 * what a port offers (issue #178): a trade station deliveries only, a military station or depot bounties only, a research station surveys only; a pirate den
 * keeps the old mix (a bounty or a delivery, half each). The player holds at most MAX_JOBS tasks at once (finished bounties and surveys waiting for
 * hand-in are claims, not tasks, and do not count).
 *
 * Delivery: DELIVERY_COUNT units of one of DELIVERY_ITEMS, handed over on accepting, to a station DELIVERY_HOPS jumps away. Pay =
 * DELIVERY_BASE + DELIVERY_PER_HOP x hops + DELIVERY_PER_DANGER x the destination's danger; due DELIVERY_TURNS_BASE + DELIVERY_TURNS_PER_HOP x hops turns on.
 * Bounty: destroy one named ship of a faction the issuer is at war with, placed on taking the job at a node BOUNTY_HOPS jumps away that the player has not
 * entered yet. Pay = BOUNTY_BASE + BOUNTY_PER_HOP x hops + BOUNTY_PER_DANGER x danger; due BOUNTY_TURNS_BASE + BOUNTY_TURNS_PER_HOP x hops turns on.
 * Survey: enter a node SURVEY_HOPS jumps away that has a feature (a nebula, black hole or blue giant at its sector's centre, or an asteroid field). Pay =
 * SURVEY_BASE + SURVEY_PER_HOP x hops + SURVEY_PER_DANGER x danger + the feature's SURVEY_FEATURE_BONUS; due SURVEY_TURNS_BASE + SURVEY_TURNS_PER_HOP x hops turns on.
 * A scanner module requirement comes later (issue #178 follow-up): for now entering the node is enough.
 * Bounties and surveys pay on hand-in (a claim, never expires) at a station of the issuing type and faction, not on completion.
 * Done: +JOB_REPUTATION with the issuer (on payment). Failed or abandoned: -JOB_FAIL_REPUTATION; a delivery not made also adds BREACH_NOTORIETY (the goods were kept).
 */
export const OFFER_TURNS = 12;
export const OFFERS_PER_PORT = 3;
export const MAX_JOBS = 4;
export const DELIVERY_ITEMS: readonly string[] = ['item.electronics', 'item.parts', 'item.metal', 'item.polymer', 'item.ration'];
export const DELIVERY_COUNT = { min: 5, max: 15 } as const;
export const DELIVERY_HOPS = { min: 2, max: 6 } as const;
export const DELIVERY_BASE = 60;
export const DELIVERY_PER_HOP = 40;
export const DELIVERY_PER_DANGER = 25;
export const DELIVERY_TURNS_BASE = 6;
export const DELIVERY_TURNS_PER_HOP = 3;
export const BOUNTY_HOPS = { min: 2, max: 6 } as const;
export const BOUNTY_BASE = 150;
export const BOUNTY_PER_HOP = 30;
export const BOUNTY_PER_DANGER = 60;
export const BOUNTY_TURNS_BASE = 12;
export const BOUNTY_TURNS_PER_HOP = 3;
export const JOB_REPUTATION = 1;
export const JOB_FAIL_REPUTATION = 1;
/** A bounty on a pirate faction's ship also pleases each pirate faction at war with it. */
export const RIVAL_REPUTATION = 0.5;
export const BREACH_NOTORIETY = 3;
/** Finished and accepted offer keys remembered (so an offer is not taken twice); the oldest are forgotten. */
export const JOB_LOG_MAX = 64;
export const SURVEY_HOPS = { min: 1, max: 5 } as const;
export const SURVEY_BASE = 120;
export const SURVEY_PER_HOP = 35;
export const SURVEY_PER_DANGER = 40;
export const SURVEY_TURNS_BASE = 10;
export const SURVEY_TURNS_PER_HOP = 3;
/** The features a survey can be for, in a fixed order, and what each adds to the pay. */
export const SURVEY_FEATURES = ['nebula', 'black_hole', 'blue_giant', 'asteroids'] as const;
export const SURVEY_FEATURE_BONUS: Record<(typeof SURVEY_FEATURES)[number], number> = { nebula: 0, black_hole: 60, blue_giant: 30, asteroids: 0 };
/** Seconds the station shuttle waits before the next try after a handover was called off (combat, no dock; trade/handover.ts). */
export const HANDOVER_RETRY_SEC = 20;
