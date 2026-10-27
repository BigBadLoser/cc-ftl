import type { YardDef } from '../sim';

/**
 * Shipyards (sim/yard): trading and military stations of the station and hub tiers rebuild a ship's hull for credits and metal. You paint new
 * floor against the hull; the yard builds it and closes it with walls. All the numbers are here, provisional.
 *  - `sizes`: tiles (painted floor) one order may cover, and the tier's price multiplier (a hub costs more, and may do more).
 *  - `maxTiles`: the overall ship maximum, counting every non-space tile (the starter ship covers 504).
 *  - `perTile`: price per painted tile at danger 0 (walls are part of the job); it rises `dangerStep` per node danger tier.
 *  - `crew`: the contractors the station's shuttle brings.
 */
export const yard = {
  kinds: ['station.trading', 'station.military'],
  sizes: { station: { cap: 24, price: 1 }, hub: { cap: 60, price: 1.4 } },
  maxTiles: 900,
  perTile: { credits: 18, metal: 1.5 },
  dangerStep: 0.05,
  crew: { role: 'role.engineer', count: 3 },
} satisfies YardDef;
