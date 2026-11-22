import { AsteroidC } from '../asteroids/components';
import { ShipC } from '../combat/components';
import { atBattle } from '../combat/engage';
import { MiningPodC } from '../mining/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';

/**
 * NPC ships go about their business in the player's node (#603), through the commands the player uses: no NPC copy of a mechanic. Ships never
 * move (DESIGN "Combat"); their craft do. Once a second:
 * - a miner's idle mining pods are ordered to the field it works (`mining.order`, as the player's mining tool sends it).
 */
export function tendTraffic(sim: Sim): void {
  if (sim.tick % TICK_HZ !== 0) return;
  const field = minersField(sim);
  if (field === undefined) return;
  for (const f of sim.galaxy.fleets) {
    if (f.node !== sim.galaxy.current || f.role !== 'miner') continue;
    for (const c of f.ships) {
      const ship = c.ship;
      const s = ship === undefined ? undefined : sim.world.get(ship, ShipC);
      if (ship === undefined || s?.state !== 'active' || atBattle(sim, ship)) continue;
      for (const pod of sim.world.query(VehicleC)) {
        const v = sim.world.get(pod, VehicleC);
        if (v?.homeShip !== ship || v.state !== 'stowed' || !vehicleDefOf(sim, v)?.mining || sim.world.has(pod, MiningPodC)) continue;
        sim.enqueue({ type: 'mining.order', pod, asteroid: field });
      }
    }
  }
}

/** The asteroid field NPC miners in the player's node work (#603): the node's first. Placement (`businessAnchor`) and the pods' orders share it. */
export function minersField(sim: Sim): number | undefined {
  return [...sim.world.query(AsteroidC)].sort((a, b) => a - b)[0];
}
