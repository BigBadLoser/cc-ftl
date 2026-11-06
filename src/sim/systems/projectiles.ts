import { BodyC } from '../body';
import { ProjectileC } from '../combat/components';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';

/**
 * Moves every projectile along its straight sector-space flight; t reaches 1 on arrival (resolved by impacts). A shot
 * aimed at a shuttle homes in on it: it flies at its launch speed straight at the shuttle's current position and
 * arrives when it catches up (t is the share of the distance covered so far). A shuttle that is gone stops the homing.
 */
export function projectileSystem(sim: Sim): void {
  for (const id of sim.world.query(ProjectileC)) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || p.t >= 1) continue;
    const v = p.target.vehicle && sim.world.has(p.target.vehicle, VehicleC) ? sim.world.get(p.target.vehicle, BodyC) : undefined;
    if (v) {
      home(p, v);
      continue;
    }
    p.t = Math.min(1, p.t + p.dt);
    p.x = p.x0 + (p.x1 - p.x0) * p.t;
    p.y = p.y0 + (p.y1 - p.y0) * p.t;
  }
}

function home(p: { x: number; y: number; x0: number; y0: number; x1: number; y1: number; t: number; dt: number }, v: { x: number; y: number }): void {
  const step = p.dt * Math.max(1, Math.hypot(p.x1 - p.x0, p.y1 - p.y0));
  const dx = v.x - p.x;
  const dy = v.y - p.y;
  const dist = Math.hypot(dx, dy);
  p.x1 = v.x;
  p.y1 = v.y;
  if (dist <= step) {
    p.x = v.x;
    p.y = v.y;
    p.t = 1;
    return;
  }
  p.x += (dx / dist) * step;
  p.y += (dy / dist) * step;
  const done = Math.hypot(p.x - p.x0, p.y - p.y0);
  p.t = Math.min(0.999, done / (done + dist - step));
}
