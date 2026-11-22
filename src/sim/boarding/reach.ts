import { AirlockC } from '../modules/airlock';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { shipsHostile } from '../combat/engage';
import { VehicleC, type Vehicle } from '../vehicles/components';
import { occupants, vehicleFaction } from '../vehicles/lifecycle';

/** The ship a shuttle is tied to right now: where it is docked or heading to dock, or what it hovers at or flies to hover at; 0 if none. */
function shuttleTarget(sim: Sim, v: Vehicle): number {
  const airlockShip = (airlock: number): number => (sim.world.has(airlock, AirlockC) ? shipIdOf(sim, sim.world.get(airlock, ModuleC)) : 0);
  if (v.state === 'docked') return airlockShip(v.dock);
  if (v.dest?.type === 'dock') return airlockShip(v.dest.airlock);
  if (v.dest?.type === 'hover') return v.dest.ship;
  return v.state === 'flying' && v.dest === null && v.hover ? v.hover : 0;
}

/**
 * Can a foe still reach this ship with a boarding party? True when a shuttle with someone aboard is docked at it, flying to dock or hover at it,
 * or hovering beside it (the party is out, or about to land), and it is the player's or its home ship is the ship's foe (`shipsHostile`: an NPC
 * fight's other side too). A ship no boarder has a way to reach is one to give up on (`crewSubdued`).
 */
export function boardersReach(sim: Sim, shipId: number): boolean {
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC) as Vehicle;
    if (occupants(v).length === 0 || shuttleTarget(sim, v) !== shipId) continue;
    if (vehicleFaction(sim, v) === 'player' || shipsHostile(sim, v.homeShip, shipId)) return true;
  }
  return false;
}
