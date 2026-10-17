import { consumeAmmo } from '../combat/ammo';
import { CombatC, IonC, ProjectileC, WeaponC, type Target } from '../combat/components';
import { moduleCenter } from '../combat/geometry';
import { operatorSkill } from '../combat/operators';
import { shipEntityOf, shipOf } from '../combat/ships';
import { resolveTarget } from '../combat/targets';
import { ModuleC } from '../modules/components';
import type { WeaponDef } from '../registry';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { MIN_SPREAD_FACTOR, SPREAD_PER_GUNNERY } from '../tuning';

/**
 * Launches shots. A charged weapon fires a volley at its resolved target when the ship is not on hold (or on
 * combat.fireVolley, which fires every charged weapon once). Multi-shot weapons launch one shot per shotDelaySec.
 * Each shot is a projectile entity flying through sector space; ammo is consumed per shot. A weapon that loses
 * power, hp or ammo mid-volley drops the rest of it.
 */
export function firingSystem(sim: Sim): void {
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const w = sim.world.get(id, WeaponC);
    const weaponId = m && sim.content.modules[m.def]?.weapon;
    const def = weaponId ? sim.content.weapons?.[weaponId] : undefined;
    const ship = m && shipOf(sim, m.gridId);
    const combat = ship && sim.world.get(shipEntityOf(sim, ship.gridId), CombatC);
    if (!m || !w || !def || !ship || !combat) continue;
    const ready = ship.state === 'active' && m.powered && m.hp > 0 && !sim.world.has(id, IonC);
    if (w.shotsLeft > 0) {
      if (!ready) w.shotsLeft = 0;
      else if (sim.tick >= w.nextShotTick) launchNext(sim, id, w, weaponId as string, def, m.gridId);
      continue;
    }
    if (!ready || w.charge < 1 || (combat.hold && !combat.volley)) continue;
    const target = resolveTarget(sim, id, combat);
    if (!target) continue;
    w.charge = 0;
    w.shotsLeft = def.shots;
    w.volleyTarget = target;
    launchNext(sim, id, w, weaponId as string, def, m.gridId);
  }
  for (const id of sim.world.query(CombatC)) {
    const c = sim.world.get(id, CombatC);
    if (c) c.volley = false;
  }
}

function launchNext(
  sim: Sim, moduleId: number, w: { shotsLeft: number; nextShotTick: number; volleyTarget: Target | null }, weapon: string,
  def: WeaponDef, gridId: number,
): void {
  w.shotsLeft--;
  w.nextShotTick = sim.tick + Math.max(1, Math.round(def.shotDelaySec * TICK_HZ));
  const target = w.volleyTarget;
  if (!target) return void (w.shotsLeft = 0);
  if (def.ammo && !consumeAmmo(sim, gridId, def.ammo)) return void (w.shotsLeft = 0);
  const from = moduleCenter(sim, moduleId);
  const alive = sim.world.get(target.moduleId, ModuleC)?.gridId === target.gridId;
  const to = moduleCenter(sim, alive ? target.moduleId : 0) ?? centerOf(sim, target.gridId);
  if (!from || !to) return void (w.shotsLeft = 0);
  const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const skill = operatorSkill(sim, gridId, 'weapons');
  const spread = def.spread * Math.max(MIN_SPREAD_FACTOR, 1 - SPREAD_PER_GUNNERY * skill);
  const projectile = sim.world.createEntity();
  sim.world.add(projectile, ProjectileC, {
    weapon, fromGridId: gridId, fromModuleId: moduleId, target: { ...target },
    x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, t: 0, dt: def.speed / dist / TICK_HZ,
    spread, pdRolled: false,
  });
  sim.events.emit({
    type: 'weapon.fired', gridId, weaponId: moduleId, weapon, projectile, targetGridId: target.gridId, targetModuleId: target.moduleId,
  });
}

function centerOf(sim: Sim, gridId: number): { x: number; y: number } | null {
  const ship = shipOf(sim, gridId);
  return ship ? { x: ship.x + ship.width / 2, y: ship.y + ship.height / 2 } : null;
}
