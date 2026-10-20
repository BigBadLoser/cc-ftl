import { BodyC } from '../body';
import { ContainerC } from '../containers/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/** Detached containers drift: inert bodies moving at their own velocity and spin (nothing steers or stops them yet). */
export function containerDriftSystem(sim: Sim): void {
  for (const id of sim.world.query(ContainerC, BodyC)) {
    const c = sim.world.get(id, ContainerC);
    const b = sim.world.get(id, BodyC);
    if (!c || !b || c.state !== 'drifting') continue;
    b.x += c.vx / TICK_HZ;
    b.y += c.vy / TICK_HZ;
    b.heading += c.spin / TICK_HZ;
  }
}
