import { WeaponC } from '../combat/components';
import { aimDirection, turretPosition } from '../combat/geometry';
import { shipById, shipEntityOf } from '../combat/ships';
import { CombatC } from '../combat/components';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { gridIdOf } from '../regions';

/**
 * Turns every weapon's roof turret toward its current target (own target, else the ship-wide one), quantised to
 * 8 directions. Uses the aimed module's centre or the ship centre; draws nothing from sim.rng. With no target
 * the turret keeps its last aim. The firing system also snaps the aim to the real shot direction when it fires.
 */
export function turretSystem(sim: Sim): void {
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const w = sim.world.get(id, WeaponC);
    const m = sim.world.get(id, ModuleC);
    const combat = m && sim.world.get(shipEntityOf(sim, gridIdOf(sim, m)), CombatC);
    const t = w && (w.target ?? combat?.target);
    const from = w && turretPosition(sim, id);
    if (!w || !t || !from) continue;
    const ship = shipById(sim, t.ship);
    const alive = gridIdOf(sim, sim.world.get(t.moduleId, ModuleC)) === ship?.gridId;
    const to = (alive && turretPosition(sim, t.moduleId)) || (ship && { x: ship.x + ship.width / 2, y: ship.y + ship.height / 2 });
    if (to) w.aim = aimDirection(to.x - from.x, to.y - from.y);
  }
}
