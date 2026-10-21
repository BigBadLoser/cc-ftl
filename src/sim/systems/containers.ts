import { BodyC } from '../body';
import { ContainerC } from '../containers/components';
import { DRIFT_DAMP_SEC, DRIFT_STOP } from '../containers/detach';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/** Per-tick velocity factor of the drift damping. */
const DAMP = Math.exp(-1 / (DRIFT_DAMP_SEC * TICK_HZ));

/**
 * Detached containers drift: inert bodies moving at their own velocity and spin, both easing off (gentle damping) until
 * they come to rest, so a container stays in the node as loot. Nothing steers them.
 */
export function containerDriftSystem(sim: Sim): void {
  for (const id of sim.world.query(ContainerC, BodyC)) {
    const c = sim.world.get(id, ContainerC);
    const b = sim.world.get(id, BodyC);
    if (!c || !b || c.state !== 'drifting' || (c.vx === 0 && c.vy === 0 && c.spin === 0)) continue;
    b.x += c.vx / TICK_HZ;
    b.y += c.vy / TICK_HZ;
    b.heading += c.spin / TICK_HZ;
    c.vx *= DAMP;
    c.vy *= DAMP;
    c.spin *= DAMP;
    if (Math.hypot(c.vx, c.vy) < DRIFT_STOP) { c.vx = 0; c.vy = 0; }
    if (Math.abs(c.spin) < DRIFT_STOP) c.spin = 0;
  }
}
