import type { YardDef } from '../sim';

/**
 * Shipyards (sim/yard): trading and military stations of the station and hub tiers build the hull you planned (the outer profile only; interior
 * walls and doors are your own free builds). Price and the visit cap count hull tiles (the outer ring); capacity, the overall maximum and the ship panel's "Size N / M" count interior area.
 * All the numbers are here, provisional.
 *  - `sizes`: hull tiles one visit builds (a hub does more) and the tier's price multiplier (a hub costs more).
 *  - `maxSize`: the overall ship maximum in size, interior area (the starter is 416; two Mk III engines carry 1400).
 *  - `perTile`: price per hull tile at danger 0 (the floor the new hull encloses is included); it rises `dangerStep` per node danger tier.
 *  - `crew`: the contractors the station's shuttle brings.
 */
export const yard = {
  kinds: ['station.trading', 'station.military'],
  sizes: { station: { cap: 24, price: 1 }, hub: { cap: 60, price: 1.4 } },
  maxSize: 1400,
  perTile: { credits: 20, metal: 1.5 },
  dangerStep: 0.05,
  crew: { role: 'role.engineer', count: 3 },
} satisfies YardDef;
