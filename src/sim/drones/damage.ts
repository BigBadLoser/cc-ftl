import { BodyC, ALT } from '../body';
import { shipGrid } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { DRONE_FIRE_DAMAGE } from '../tuning';
import { DroneC, type Drone } from './components';

/**
 * Drone damage (DESIGN.md "Drones"). Inside a ship: fire on its tile and crew hand weapons. In space: only point defence, flak and enemy
 * defence drones (ordinary ship guns cannot track one). At 0 hp the drone system wrecks it on its next turn (drones/bay.ts `wreckDrone`).
 */
export type DroneHarm = 'fire' | 'gunfire' | 'pointDefence' | 'drone' | 'flak';

/** Take `amount` hp off a drone. */
export function damageDrone(sim: Sim, id: number, amount: number, cause: DroneHarm): void {
  const d = sim.world.get(id, DroneC);
  if (!d || amount <= 0 || d.hp <= 0) return;
  d.hp = Math.max(0, d.hp - amount);
  sim.events.emit({ type: 'drone.hit', drone: id, damage: amount, hp: d.hp, cause });
}

/** One tick of fire on a drone inside its ship (docked or flying under the roof): it burns like a module, by the fire's intensity. */
export function burnDrone(sim: Sim, id: number, d: Drone): void {
  const b = sim.world.get(id, BodyC);
  if (!b || d.space || b.alt > ALT.roof) return;
  const grid = shipGrid(sim, d.ship);
  const x = Math.floor(b.x), y = Math.floor(b.y);
  if (!grid?.has('fire') || !grid.inBounds(x, y)) return;
  const fire = grid.get('fire', x, y);
  if (fire <= 0) return;
  d.hp = Math.max(0, d.hp - (DRONE_FIRE_DAMAGE * fire) / 255 / TICK_HZ);
}
