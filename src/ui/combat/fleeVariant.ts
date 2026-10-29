/** MOCK (#186): the Flee placement under comparison. `?flee=a` (default): an end cap on the ship strip. `?flee=b`: under the clock and time controls. Delete the loser. */
export const fleeVariant: 'a' | 'b' = new URLSearchParams(location.search).get('flee') === 'b' ? 'b' : 'a';
