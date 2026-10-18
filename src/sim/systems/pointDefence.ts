import { IonC, ProjectileC } from '../combat/components';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { PD_CAP, PD_CHANCE_PER_TIER, PD_WINDOW } from '../tuning';

/**
 * Point defence: each interceptable shot (missiles) gets one roll, once it is PD_WINDOW of the way to its
 * target. Chance = PD_CHANCE_PER_TIER x total tier of the target ship's powered AI cores (capped at PD_CAP).
 */
export function pointDefenceSystem(sim: Sim): void {
  for (const id of [...sim.world.query(ProjectileC)]) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || p.pdRolled || p.t < PD_WINDOW || !sim.content.weapons?.[p.weapon]?.interceptable) continue;
    p.pdRolled = true;
    const chance = Math.min(PD_CAP, PD_CHANCE_PER_TIER * coreTiers(sim, p.target.gridId));
    if (chance > 0 && sim.rng.chance(chance)) {
      sim.events.emit({ type: 'projectile.intercepted', projectile: id, weapon: p.weapon, gridId: p.target.gridId });
      sim.world.destroyEntity(id);
    }
  }
}

function coreTiers(sim: Sim, gridId: number): number {
  let tiers = 0;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const core = m && m.gridId === gridId ? sim.content.modules[m.def]?.aiCore : undefined;
    if (m && core && m.powered && m.hp > 0 && !sim.world.has(id, IonC) && isDeployed(sim, id)) tiers += core.tier;
  }
  return tiers;
}
