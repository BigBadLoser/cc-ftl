import { BodyC } from '../body';
import { ammoCount, consumeAmmo } from '../combat/ammo';
import { CombatC, IonC, ProjectileC, WeaponC, type Target } from '../combat/components';
import { aimDirection, turretPosition } from '../combat/geometry';
import { mannedConsole, operatorSkill } from '../combat/operators';

import { resolveTarget } from '../combat/targets';
import { addHeat, fireBlocked, heatCeilingBlocks } from '../combat/heat';
import { updateCommit } from '../combat/commit';
import { isAiFaction } from '../combat/factions';
import { ModuleC } from '../modules/components';
import { VehicleC } from '../vehicles/components';
import type { WeaponDef } from '../registry';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { MIN_SPREAD_FACTOR, SPREAD_PER_GUNNERY } from '../tuning';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';

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
    const shipId = m ? shipIdOf(sim, m) : 0;
    const ship = shipById(sim, shipId);
    const combat = ship && sim.world.get(shipId, CombatC);
    if (!m || !w || !def || !ship || !combat) continue;
    const ready = ship.state === 'active' && !fireBlocked(combat) && m.powered && m.hp > 0 && !sim.world.has(id, IonC) && isDeployed(sim, id);
    if (w.shotsLeft > 0) {
      w.commit = null;
      if (!ready) w.shotsLeft = 0;
      else if (sim.tick >= w.nextShotTick) launchNext(sim, id, w, weaponId as string, def, shipIdOf(sim, m));
      continue;
    }
    const held = combat.hold && !combat.volley;
    // Enemy weapons telegraph: in the last window of the charge they commit to a target and aim area (the module it will hit), which the shot then keeps.
    const live = ready && !held && (w.charge >= 1 || (!!mannedConsole(sim, shipId, 'weapons') && (!def.ammo || ammoCount(sim, shipId, def.ammo) > 0)));
    const commit = isAiFaction(ship.faction) ? updateCommit(sim, id, def.chargeSec, live, () => resolveTarget(sim, id, combat)) : null;
    if (!ready || w.charge < 1 || held) continue;
    const target = commit?.target ?? resolveTarget(sim, id, combat);
    if (!target) continue;
    // Enemy ships manage their own heat: a volley that would overheat them waits for a vent. The player's ship fires into an overheat if told to.
    if (isAiFaction(ship.faction) && heatCeilingBlocks(combat, def.heat)) continue;
    addHeat(sim, shipId, def.heat);
    w.charge = 0;
    w.shotsLeft = def.shots;
    w.volleyTarget = target;
    w.commit = null;
    launchNext(sim, id, w, weaponId as string, def, shipIdOf(sim, m));
  }
  for (const id of sim.world.query(CombatC)) {
    const c = sim.world.get(id, CombatC);
    if (c) c.volley = false;
  }
}

function launchNext(
  sim: Sim, moduleId: number, w: { shotsLeft: number; nextShotTick: number; volleyTarget: Target | null; aim: number }, weapon: string,
  def: WeaponDef, shipId: number,
): void {
  w.shotsLeft--;
  w.nextShotTick = sim.tick + Math.max(1, Math.round(def.shotDelaySec * TICK_HZ));
  const target = w.volleyTarget;
  if (!target) return void (w.shotsLeft = 0);
  if (def.ammo && !consumeAmmo(sim, shipId, def.ammo)) return void (w.shotsLeft = 0);
  const from = turretPosition(sim, moduleId);
  const targetGrid = target.ship;
  const alive = shipIdOf(sim, sim.world.get(target.moduleId, ModuleC)) === targetGrid;
  const vehicle = target.vehicle && sim.world.has(target.vehicle, VehicleC) ? sim.world.get(target.vehicle, BodyC) : undefined;
  const to = vehicle ?? (target.tile ? { x: target.tile.x + 0.5, y: target.tile.y + 0.5 } : null) ?? turretPosition(sim, alive ? target.moduleId : 0) ?? centerOf(sim, targetGrid);
  if (!from || !to) return void (w.shotsLeft = 0);
  w.aim = aimDirection(to.x - from.x, to.y - from.y);
  const dist = Math.max(1, Math.hypot(to.x - from.x, to.y - from.y));
  const skill = operatorSkill(sim, shipId, 'weapons');
  const spread = def.spread * Math.max(MIN_SPREAD_FACTOR, 1 - SPREAD_PER_GUNNERY * skill);
  const projectile = sim.world.createEntity();
  sim.world.add(projectile, ProjectileC, {
    weapon, fromShip: shipId, fromModuleId: moduleId, target: { ...target },
    x0: from.x, y0: from.y, x1: to.x, y1: to.y, x: from.x, y: from.y, t: 0, dt: def.speed / dist / TICK_HZ,
    spread, pdRolled: false,
  });
  sim.events.emit({
    type: 'weapon.fired', ship: shipId, weaponId: moduleId, weapon, projectile, targetShip: target.ship, targetModuleId: target.moduleId,
  });
}

function centerOf(sim: Sim, shipId: number): { x: number; y: number } | null {
  const ship = shipById(sim, shipId);
  return ship ? { x: ship.x + ship.width / 2, y: ship.y + ship.height / 2 } : null;
}
