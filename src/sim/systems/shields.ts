import { CombatC, ShipC } from '../combat/components';
import { fireBlocked, overchargeActive } from '../combat/heat';
import { OVERCHARGE_SHIELD_REGEN, SHIELD_REGEN_MULT } from '../combat/heatTuning';
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
    s.max = ship.state === 'wreck' || ship.state === 'fled' || ship.state === 'prize' ? 0 : shieldCapacity(sim, id, true);
    if (s.layers > s.max) s.layers = s.max;
    const combat = sim.world.get(id, CombatC);
    if (combat && fireBlocked(combat)) {
      s.layers = 0; // a vent or an overheat holds the shields down
      s.timer = 0;
      continue;
    }
    if (s.layers >= s.max) {
      s.timer = 0;
      continue;
    }
    const op = mannedConsole(sim, id, 'shields');
    const rate = SHIELD_REGEN_MULT * (1 + (op ? SHIELD_OPERATED_BONUS + SKILL_STEP * skillOf(sim, op.crew, 'shielding') : 0)) * (combat && overchargeActive(combat, 'shields') ? OVERCHARGE_SHIELD_REGEN : 1);
    s.timer += rate / TICK_HZ;
    if (s.timer >= shieldRechargeSec(sim, id)) {
      s.layers++;
      s.timer = 0;
    }
  }
}
