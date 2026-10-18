import { ProjectileC } from '../combat/components';
import type { Sim } from '../sim';

/** Moves every projectile along its straight sector-space flight; t reaches 1 on arrival (resolved by impacts). */
export function projectileSystem(sim: Sim): void {
  for (const id of sim.world.query(ProjectileC)) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || p.t >= 1) continue;
    p.t = Math.min(1, p.t + p.dt);
    p.x = p.x0 + (p.x1 - p.x0) * p.t;
    p.y = p.y0 + (p.y1 - p.y0) * p.t;
  }
}
