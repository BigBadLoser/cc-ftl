import { CombatC, ShipC, WeaponC, type Target } from '../combat/components';
import { targetableShip, targetableVehicle } from '../combat/targets';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';

/**
 * Keeps targets valid: a target whose ship left or fled is cleared; one whose module is gone or destroyed
 * falls back to "any module" of that ship. Picking the concrete module for each shot happens at fire time.
 */
export function targetingSystem(sim: Sim): void {
  for (const id of sim.world.query(ShipC, CombatC)) {
    const combat = sim.world.get(id, CombatC);
    if (combat) combat.target = fix(sim, combat.target);
  }
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const w = sim.world.get(id, WeaponC);
    if (w?.target) w.target = fix(sim, w.target);
  }
}

function fix(sim: Sim, t: Target | null): Target | null {
  if (!t) return null;
  if (t.vehicle) return targetableVehicle(sim, t.vehicle) ? t : null;
  if (!targetableShip(sim, t.gridId)) return null;
  if (t.moduleId === 0) return t;
  const m = sim.world.get(t.moduleId, ModuleC);
  return m && m.gridId === t.gridId && m.hp > 0 ? t : { gridId: t.gridId, moduleId: 0 };
}
