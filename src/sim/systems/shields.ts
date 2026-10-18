import { CombatC, ShipC } from '../combat/components';
import { mannedConsole, skillOf } from '../combat/operators';
import { shieldCapacity, shieldRechargeSec } from '../combat/ships';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { SHIELD_OPERATED_BONUS, SKILL_STEP } from '../tuning';

/**
 * Shield layers: the maximum comes from the running generators (floor(|power| x layersPerPower) each). Layers
 * above the maximum vanish at once; below it one layer returns every rechargeSec, faster with an operator at
 * the shield console. A generator counts only once its emitter dish is fully deployed. Wrecks and fled ships have none.
 */
export function shieldSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const ship = sim.world.get(id, ShipC);
    const s = sim.world.get(id, CombatC)?.shield;
    if (!ship || !s) continue;
    s.max = ship.state === 'wreck' || ship.state === 'fled' || ship.state === 'prize' ? 0 : shieldCapacity(sim, ship.gridId, true);
    if (s.layers > s.max) s.layers = s.max;
    if (s.layers >= s.max) {
      s.timer = 0;
      continue;
    }
    const op = mannedConsole(sim, ship.gridId, 'shields');
    const rate = 1 + (op ? SHIELD_OPERATED_BONUS + SKILL_STEP * skillOf(sim, op.crew, 'shielding') : 0);
    s.timer += rate / TICK_HZ;
    if (s.timer >= shieldRechargeSec(sim, ship.gridId)) {
      s.layers++;
      s.timer = 0;
    }
  }
}
