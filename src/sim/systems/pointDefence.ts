import { BodyC } from '../body';
import { IonC, PointDefenseC, ProjectileC } from '../combat/components';
import { aimDirection, moduleCenter } from '../combat/geometry';
import { chipShuttle, defenderOf, droneThreats, shipCentre, shuttleThreat } from '../combat/intercept';
import { damageDrone } from '../drones/damage';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import {
  DRONE_PD_CHANCE, DRONE_PD_DAMAGE, PD_CHANCE, PD_WINDOW, VEHICLE_PD_CHANCE, VEHICLE_PD_DAMAGE, VEHICLE_PD_INTERVAL, VEHICLE_PD_RANGE,
} from '../tuning';
import { DroneC } from '../drones/components';
import { VehicleC } from '../vehicles/components';
import { shipById } from '../combat/ships';
import { shipIdOf } from '../regions';

/**
 * Point defence: each interceptable shot (missiles) gets one roll per working point-defence module on the target
 * ship, once it is PD_WINDOW of the way to its target (so modules stack). A module works when it is powered, intact,
 * not ion-struck and fully deployed, and the ship has a powered, intact AI core with its mast out to operate it.
 * Each module's turret tracks the incoming shots (the one it is engaging last wins).
 *
 * Shuttles: a missile homing on a shuttle is covered by the shuttle's home ship's point defence while the shuttle is
 * within VEHICLE_PD_RANGE of it. A hostile shuttle in flight within range of a defending ship, or docked at it, is an
 * incoming threat too: every VEHICLE_PD_INTERVAL ticks each working module rolls VEHICLE_PD_CHANCE to hit it for
 * VEHICLE_PD_DAMAGE hp, never below VEHICLE_PD_FLOOR of its max hp. Enemy drones out in space within VEHICLE_PD_RANGE are shot the same way
 * (DRONE_PD_CHANCE for DRONE_PD_DAMAGE, the nearest first). Who counts as an enemy is the shared rule in combat/intercept.ts.
 */
export function pointDefenceSystem(sim: Sim): void {
  const gunsByGrid = new Map<number, number[]>();
  const coreByGrid = new Map<number, boolean>();
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || !workingModule(sim, id)) continue;
    if (def.aiCore) coreByGrid.set(shipIdOf(sim, m), true);
    if (def.pointDefense) gunsByGrid.set(shipIdOf(sim, m), [...(gunsByGrid.get(shipIdOf(sim, m)) ?? []), id]);
  }
  for (const id of [...sim.world.query(ProjectileC)]) {
    const p = sim.world.get(id, ProjectileC);
    if (!p || !sim.content.weapons?.[p.weapon]?.interceptable) continue;
    const defender = defenderOf(sim, p.target);
    const guns = coreByGrid.get(defender) ? gunsByGrid.get(defender) ?? [] : [];
    for (const g of guns) track(sim, g, p.x, p.y);
    if (p.pdRolled || p.t < PD_WINDOW) continue;
    p.pdRolled = true;
    for (const g of guns) {
      if (!sim.rng.chance(PD_CHANCE)) continue;
      track(sim, g, p.x, p.y);
      sim.events.emit({ type: 'projectile.intercepted', projectile: id, weapon: p.weapon, ship: defender });
      sim.world.destroyEntity(id);
      break;
    }
  }
  if (sim.tick % VEHICLE_PD_INTERVAL !== 0) return;
  engageVehicles(sim, gunsByGrid, coreByGrid);
  engageDrones(sim, gunsByGrid, coreByGrid);
}

function engageVehicles(sim: Sim, gunsByGrid: Map<number, number[]>, coreByGrid: Map<number, boolean>): void {
  for (const vid of [...sim.world.query(VehicleC)]) {
    const b = sim.world.get(vid, BodyC);
    if (!b) continue;
    for (const [shipId, guns] of gunsByGrid) {
      const c = shipCentre(sim, shipId);
      if (!c || !coreByGrid.get(shipId) || shipById(sim, shipId)?.state === 'wreck' || !shuttleThreat(sim, shipId, vid, c.x, c.y, VEHICLE_PD_RANGE)) continue;
      for (const g of guns) {
        track(sim, g, b.x, b.y);
        if (sim.rng.chance(VEHICLE_PD_CHANCE)) chipShuttle(sim, vid, VEHICLE_PD_DAMAGE);
      }
      if (!sim.world.get(vid, VehicleC)) break;
    }
  }
}

/** Each working module takes one shot at the nearest enemy drone in space within range of its ship. */
function engageDrones(sim: Sim, gunsByGrid: Map<number, number[]>, coreByGrid: Map<number, boolean>): void {
  for (const [shipId, guns] of gunsByGrid) {
    const c = shipCentre(sim, shipId);
    if (!c || !coreByGrid.get(shipId) || shipById(sim, shipId)?.state === 'wreck') continue;
    const near = droneThreats(sim, shipId, c.x, c.y, VEHICLE_PD_RANGE);
    if (near.length === 0) continue;
    for (const g of guns) {
      const target = near.find((id) => (sim.world.get(id, DroneC)?.hp ?? 0) > 0);
      const b = target && sim.world.get(target, BodyC);
      if (!target || !b) break;
      track(sim, g, b.x, b.y);
      if (sim.rng.chance(DRONE_PD_CHANCE)) damageDrone(sim, target, DRONE_PD_DAMAGE, 'pointDefence');
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
