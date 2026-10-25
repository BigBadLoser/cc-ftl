/**
 * Station jobs (missions v1, issue #52): deliveries and bounties offered at stations, depots and dens (jobs.ts, jobOffers.ts).
 *
 * Offers are a pure function of (seed, port, OFFER_TURNS window), so they cost nothing to save: up to OFFERS_PER_PORT per port, each a delivery or a
 * bounty. The player holds at most MAX_JOBS at once.
 *
 * Delivery: DELIVERY_COUNT units of one of DELIVERY_ITEMS, handed over on accepting, to a station DELIVERY_HOPS jumps away. Pay =
 * DELIVERY_BASE + DELIVERY_PER_HOP x hops + DELIVERY_PER_DANGER x the destination's danger; due DELIVERY_TURNS_BASE + DELIVERY_TURNS_PER_HOP x hops turns on.
 * Bounty: destroy one named ship of a faction the issuer is at war with, placed on taking the job at a node BOUNTY_HOPS jumps away that the player has not
 * entered yet. Pay = BOUNTY_BASE + BOUNTY_PER_HOP x hops + BOUNTY_PER_DANGER x danger; due BOUNTY_TURNS_BASE + BOUNTY_TURNS_PER_HOP x hops turns on.
 * Done: +JOB_REPUTATION with the issuer. Failed or abandoned: -JOB_FAIL_REPUTATION; a delivery not made also adds BREACH_NOTORIETY (the goods were kept).
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
export const BREACH_NOTORIETY = 3;
/** Finished and accepted offer keys remembered (so an offer is not taken twice); the oldest are forgotten. */
export const JOB_LOG_MAX = 64;
