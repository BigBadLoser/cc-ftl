import { IonC, PointDefenseC, ProjectileC } from '../combat/components';
import { aimDirection, moduleCenter } from '../combat/geometry';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { PD_CHANCE, PD_WINDOW } from '../tuning';

/**
 * Point defence: each interceptable shot (missiles) gets one roll per working point-defence module on the target
 * ship, once it is PD_WINDOW of the way to its target (so modules stack). A module works when it is powered, intact,
 * not ion-struck and fully deployed, and the ship has a powered, intact AI core with its mast out to operate it.
 * Each module's turret tracks the incoming shots (the one it is engaging last wins).
 */
export function pointDefenceSystem(sim: Sim): void {
  const gunsByGrid = new Map<number, number[]>();
  const coreByGrid = new Map<number, boolean>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !workingModule(sim, id)) continue;
    if (def.aiCore) coreByGrid.set(m.gridId, true);
    if (def.pointDefense) gunsByGrid.set(m.gridId, [...(gunsByGrid.get(m.gridId) ?? []), id]);
  }
  for (const id of [...sim.world.query(ProjectileC)]) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || !sim.content.weapons?.[p.weapon]?.interceptable) continue;
    const guns = coreByGrid.get(p.target.gridId) ? gunsByGrid.get(p.target.gridId) ?? [] : [];
    for (const g of guns) track(sim, g, p.x, p.y);
    if (p.pdRolled || p.t < PD_WINDOW) continue;
    p.pdRolled = true;
    for (const g of guns) {
      if (!sim.rng.chance(PD_CHANCE)) continue;
      track(sim, g, p.x, p.y);
      sim.events.emit({ type: 'projectile.intercepted', projectile: id, weapon: p.weapon, gridId: p.target.gridId });
      sim.world.destroyEntity(id);
      break;
    }
  }
}

function workingModule(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def || !(def.aiCore || def.pointDefense)) return false;
  return m.powered && m.hp > 0 && !sim.world.has(id, IonC) && isDeployed(sim, id);
}

/** Turn a turret toward a point. */
function track(sim: Sim, moduleId: number, x: number, y: number): void {
  const pd = sim.world.get(moduleId, PointDefenseC);
  const from = moduleCenter(sim, moduleId);
  if (pd && from) pd.aim = aimDirection(x - from.x, y - from.y);
}
