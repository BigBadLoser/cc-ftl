import { shipOf } from '../combat/ships';
import { DeployC, ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * Roof parts (weapon turrets, shield dishes, AI sensor masts, point-defence turrets) move toward a target of 1 (out) or 0 (stowed) at
 * 1 / (deploySec x TICK_HZ) per tick. Weapons, point defence and shield generators want to be out while the sector is in combat;
 * the AI core whenever it runs. All need to be powered and intact, on a ship that is not a wreck or fled.
 */
export function deploySystem(sim: Sim): void {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || def.deploySec === undefined) continue;
    let d = sim.world.get(id, DeployC);
    if (!d) {
      d = { amount: 0 };
      sim.world.add(id, DeployC, d);
    }
    const state = shipOf(sim, m.gridId)?.state;
    const alive = m.powered && m.hp > 0 && state !== 'wreck' && state !== 'fled';
    const wanted = def.aiCore ? alive : alive && sim.sector.inCombat;
    const step = 1 / (Math.max(def.deploySec, 0.05) * TICK_HZ);
    d.amount = wanted ? Math.min(1, d.amount + step) : Math.max(0, d.amount - step);
  }
}
