import type { YardDef } from '../sim';

/**
 * Shipyards (sim/yard): trading and military stations of the station and hub tiers build the hull you planned (the outer profile only; interior
 * walls and doors are your own free builds). Everything counts outer-hull-profile tiles, the same count as the ship panel's "Hull N / M".
 * All the numbers are here, provisional.
 *  - `sizes`: hull tiles one visit builds (a hub does more) and the tier's price multiplier (a hub costs more).
 *  - `maxHull`: the overall ship maximum in hull tiles (the starter's profile is 88; two Mk III engines carry 300).
 *  - `perTile`: price per hull tile at danger 0 (the floor the new hull encloses is included); it rises `dangerStep` per node danger tier.
 *  - `crew`: the contractors the station's shuttle brings.
 */
export const yard = {
  kinds: ['station.trading', 'station.military'],
  sizes: { station: { cap: 24, price: 1 }, hub: { cap: 60, price: 1.4 } },
  maxHull: 300,
  perTile: { credits: 20, metal: 1.5 },
  dangerStep: 0.05,
  crew: { role: 'role.engineer', count: 3 },
} satisfies YardDef;
