import { BodyC } from '../body';
import { CombatC, ShipC, type Faction } from '../combat/components';
import { factionsHostile, isAiFaction } from '../combat/factions';
import { targetableVehicle } from '../combat/targets';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ANTI_VEHICLE_RANGE } from '../tuning';
import { VehicleC } from '../vehicles/components';
import { vehicleFaction } from '../vehicles/lifecycle';

/**
 * The player's side of shuttle defence. A hostile shuttle in flight that is heading for the ship (docking at it or hovering beside
 * it) or within ANTI_VEHICLE_RANGE becomes the ship's `vehicleTarget`, which only anti-vehicle weapons aim at (the others keep the
 * ship target). It is set only when none is held, and the targeting system drops it once the shuttle is gone, so the weapons then
 * return to their previous target. A weapon's own hand-set target still wins (see resolveTarget). AI ships do this through
 * combat.setTarget in the enemy AI instead.
 */
export function vehicleDefenceSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const combat = sim.world.get(id, CombatC);
    if (!ship || !combat || isAiFaction(ship.faction) || ship.state !== 'active') continue;
    if (combat.vehicleTarget && targetableVehicle(sim, combat.vehicleTarget)) continue;
    let best = 0;
    let bestDist = Infinity;
    for (const vid of sim.world.query(VehicleC)) {
      const v = sim.world.get(vid, VehicleC);
      const b = sim.world.get(vid, BodyC);
      if (!v || !b || v.state !== 'flying' || !factionsHostile(ship.faction, vehicleFaction(sim, v) as Faction)) continue;
      const dist = Math.hypot(b.x - (ship.x + ship.width / 2), b.y - (ship.y + ship.height / 2));
      const heading = v.dest?.type === 'hover' ? v.dest.ship === id
        : v.dest?.type === 'dock' ? shipIdOf(sim, sim.world.get(v.dest.airlock, ModuleC)) === id : false;
      if ((heading || dist <= ANTI_VEHICLE_RANGE) && dist < bestDist) { best = vid; bestDist = dist; }
    }
    if (best) combat.vehicleTarget = best;
  }
}
