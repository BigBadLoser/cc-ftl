import { BodyC } from '../body';
import { droneCap, installDrones } from '../drones/bay';
import { DroneC } from '../drones/components';
import { claim, runDrone, type DronePass } from '../drones/run';
import type { Sim } from '../sim';

/**
 * Drones (DESIGN.md "Drones", sim/drones). Bays with a free slot take drone items from storage. Each ship's best live AI core sets how many
 * of its drones may be out at once (0: no live core, every drone is inert). Then each drone, in id order, charges, picks work from its def's
 * job list (one drone per target), flies, works and flies home. After power (cores are live only while powered this tick) and after vitals
 * (a crew member who just went down is a patient this tick).
 */
export function droneSystem(sim: Sim): void {
  if (!sim.content.drones) return;
  installDrones(sim);
  const ids = sim.world.query(DroneC, BodyC);
  if (ids.length === 0) return;
  const pass: DronePass = { claims: new Set(), cap: new Map(), out: new Map() };
  for (const id of ids) {
    const d = sim.world.get(id, DroneC);
    if (!d) continue;
    if (!pass.cap.has(d.ship)) pass.cap.set(d.ship, droneCap(sim, d.ship));
    if (d.state !== 'docked') pass.out.set(d.ship, (pass.out.get(d.ship) ?? 0) + 1);
    if (d.target) claim(pass, d.target);
  }
  for (const id of [...ids]) if (sim.world.has(id, DroneC)) runDrone(sim, id, pass);
}
