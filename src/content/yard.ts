import type { YardDef } from '../sim';

/**
 * Shipyards (sim/yard): trading and military stations of the station and hub tiers build the hull you planned (the outer profile only; interior
 * walls and doors are your own free builds). Price and the visit cap count tiles built (outline and the floor it encloses together); capacity, the overall maximum and the ship panel's "Size N / M" count interior area.
 * All the numbers are here, provisional.
 *  - `sizes`: tiles one visit builds (a hub does more) and the tier's price multiplier (a hub costs more).
 *  - `perTile`: price per tile built at danger 0, outline and floor alike; it rises `dangerStep` per node danger tier.
 *  - `trussFee`: the planning fee, credits per tile trussed in the quick first pass (no metal; tiles already trussed are free).
 *  - `crew`: the contractors the station's shuttle brings.
 */
export const yard = {
  kinds: ['station.trading', 'station.military'],
  sizes: { station: { cap: 40, price: 1 }, hub: { cap: 100, price: 1.4 } },
  perTile: { credits: 10, metal: 0.75 },
  trussFee: 2,
  dangerStep: 0.05,
  crew: { role: 'role.engineer', count: 3 },
} satisfies YardDef;
