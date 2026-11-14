import { AwaySiteC } from '../away/components';
import { ShipC } from '../combat/components';
import { isFerryRegion } from '../ferry/pick';
import { atHome, hovering } from '../away/phase';
import { StagingC } from '../items/components';
import { zoneTilesNear } from '../items/staging';
import { hatchSpot } from '../eva/shuttle';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { boardingTile } from '../vehicles/geometry';
import { SlabRackC, StasisC } from './components';
import { RACK_SLOTS } from './tuning';

/**
 * A shuttle's slab rack (#116): the owning reads of where slabs go into and out of a shuttle. Empty slabs ride out to a prize in it, the full ones
 * ride home. stasis/shuttle.ts keeps the racks; the stasis job hands slabs in and out at `rackTile`.
 */

/** Empty slabs in a shuttle's rack. */
export const rackEmpty = (sim: Sim, vehicle: number): number => sim.world.get(vehicle, SlabRackC)?.empty ?? 0;

/** The prisoners whose full slabs are in a shuttle's rack, ascending ids. */
export function rackFull(sim: Sim, vehicle: number): number[] {
  return [...sim.world.query(StasisC)].filter((id) => {
    const s = sim.world.get(id, StasisC);
    return s?.at === 'vehicle' && s.carrier === vehicle;
  }).sort((a, b) => a - b);
}

/** Free places in a shuttle's rack (empty and full slabs share RACK_SLOTS). */
export const rackFree = (sim: Sim, vehicle: number): number => Math.max(0, RACK_SLOTS - rackEmpty(sim, vehicle) - rackFull(sim, vehicle).length);

/**
 * The tile on a ship where crew hand slabs to and from a shuttle there, or null when it is not there. Stowed or docked: where crew board it.
 * Hovering beside the ship: the first tile of the site's staging zone (the shuttle takes slabs in through its hatch, as it takes the crated loot),
 * else the floor tile nearest its hatch spot.
 */
export function rackTile(sim: Sim, vehicle: number): { shipId: number; x: number; y: number } | null {
  const v = sim.world.get(vehicle, VehicleC);
  if (!v) return null;
  const board = boardingTile(sim, vehicle);
  if (board) return board;
  const ship = v.hover ?? 0;
  if (!ship || !hovering(v, ship)) return null;
  const zone = sim.world.get(ship, StagingC)?.tiles[0];
  if (zone) return { shipId: ship, x: zone.x, y: zone.y };
  const spot = hatchSpot(sim, vehicle);
  const t = spot && zoneTilesNear(sim, spot.shipId, spot, 1)[0];
  return t ? { shipId: ship, x: t.x, y: t.y } : null;
}

/**
 * The shuttle that carries slabs for a prize: the one serving its away site (whatever opened it), when it is one of the player's (based on a
 * ship of theirs that is not a prize). 0 for any other ship, or none.
 */
export function siteShuttle(sim: Sim, ship: number): number {
  if (sim.world.get(ship, ShipC)?.state !== 'prize') return 0;
  const id = sim.world.get(ship, AwaySiteC)?.vehicle ?? 0;
  const v = sim.world.get(id, VehicleC);
  return v && v.homeShip !== ship && isFerryRegion(sim, v.homeShip) ? id : 0;
}

/** The shuttle serving `ship` while it is there (its rack reachable at `rackTile` on that ship), or 0. */
export function rackHere(sim: Sim, ship: number): number {
  const v = siteShuttle(sim, ship);
  return v && rackTile(sim, v)?.shipId === ship ? v : 0;
}

/** True once the shuttle is at its home ship (in its bay, or docked there). */
export function rackHome(sim: Sim, vehicle: number): boolean {
  const v = sim.world.get(vehicle, VehicleC);
  return !!v && atHome(sim, v) && rackTile(sim, vehicle)?.shipId === v.homeShip;
}
