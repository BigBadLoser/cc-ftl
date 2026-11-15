/**
 * Prisoner deals at stations (#116, capture/offers.ts). Credits = `base` + `perLevel` x the prisoner's best skill level; `standing` goes to the
 * faction the deal is with (the ransoming faction, the bounty-paying navy or corporation, the black market's owner). Provisional numbers: a
 * level-5 prisoner ransoms for about a third of a starting purse.
 */
export type PrisonerDealKind = 'ransom' | 'bounty' | 'market';

export const PRISONER_DEALS: Readonly<Record<PrisonerDealKind, { base: number; perLevel: number; standing: number }>> = {
  ransom: { base: 140, perLevel: 20, standing: 2 },
  bounty: { base: 100, perLevel: 15, standing: 2 },
  market: { base: 80, perLevel: 12, standing: 1 },
};
