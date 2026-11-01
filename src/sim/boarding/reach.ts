import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { occupants, vehicleFaction } from '../vehicles/lifecycle';

/** The ship a player shuttle is tied to right now: where it is docked or heading to dock, or what it hovers at or flies to hover at; 0 if none. */
function shuttleTarget(sim: Sim, v: Vehicle): number {
  const airlockShip = (airlock: number): number => (sim.world.has(airlock, AirlockC) ? shipIdOf(sim, sim.world.get(airlock, ModuleC)) : 0);
  if (v.state === 'docked') return airlockShip(v.dock);
  if (v.dest?.type === 'dock') return airlockShip(v.dest.airlock);
  if (v.dest?.type === 'hover') return v.dest.ship;
  return v.state === 'flying' && v.dest === null && v.hover ? v.hover : 0;
}

/**
 * Can the player still reach this ship with a boarding party? True when a player shuttle with someone aboard is docked at it,
 * flying to dock or hover at it, or hovering beside it (the party is out, or about to land). A ship the player has no way to
 * reach is one to give up on (`crewSubdued`).
 */
export function playerReach(sim: Sim, shipId: number): boolean {
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (vehicleFaction(sim, v) === 'player' && occupants(v).length > 0 && shuttleTarget(sim, v) === shipId) return true;
  }
  return false;
}
