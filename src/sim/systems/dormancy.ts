import { CombatC, ShipC, WeaponC } from '../combat/components';
import { ModuleC } from '../modules/components';
import { PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { shipIdOf } from '../regions';
import { isDormant, wake, type WakeReason } from '../combat/dormant';
import type { Sim } from '../sim';

/**
 * Dormant ships (pirate dens, outposts) wake when provoked: a player ship aims at them (ship-wide or any weapon), they take
 * damage (integrity below what they had when they went quiet), or a player crew member stands aboard (boarding). Until then
 * the enemy AI leaves them alone and they do not put the node in combat. Outposts also wake on a dig or breach into them
 * (crew/handlers.ts, systems/outposts.ts); every wake goes through `wake` (combat/dormant.ts).
 */
export function dormancySystem(sim: Sim): void {
  const sleepers: number[] = [];
  for (const id of sim.world.query(ShipC)) if (isDormant(sim.world.get(id, ShipC))) sleepers.push(id);
  if (sleepers.length === 0) return;
  const aimedAt = new Set<number>();
  for (const id of sim.world.query(ShipC, CombatC)) {
    if (sim.world.get(id, ShipC)?.faction !== 'player') continue;
    const t = sim.world.get(id, CombatC)?.target;
    if (t?.ship) aimedAt.add(t.ship);
  }
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const t = sim.world.get(id, WeaponC)?.target;
    if (!t?.ship) continue;
    if (sim.world.get(shipIdOf(sim, sim.world.get(id, ModuleC)), ShipC)?.faction === 'player') aimedAt.add(t.ship);
  }
  const boarded = new Set<number>();
  for (const id of sim.world.query(AllegianceC, PositionC)) {
    if (sim.world.get(id, AllegianceC)?.faction === 'player') boarded.add(shipIdOf(sim, sim.world.get(id, PositionC)));
  }
  for (const id of sleepers) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || ship.dormant === undefined) continue;
    const why: WakeReason | '' = aimedAt.has(id) ? 'aimed' : ship.integrity < ship.dormant - 1e-6 ? 'damaged' : boarded.has(id) ? 'boarded' : '';
    if (why) wake(sim, id, why);
  }
}
