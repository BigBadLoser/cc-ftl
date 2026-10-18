import { IonC, PointDefenseC, ProjectileC } from '../combat/components';
import { aimDirection, moduleCenter } from '../combat/geometry';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { PD_CHANCE, PD_WINDOW, VEHICLE_PD_CHANCE, VEHICLE_PD_DAMAGE, VEHICLE_PD_INTERVAL, VEHICLE_PD_RANGE } from '../tuning';
import { VehicleC } from '../vehicles/components';
import { dockPoint } from '../vehicles/geometry';
import { damageVehicle, vehicleFaction } from '../vehicles/lifecycle';
import { shipOf } from '../combat/ships';

/**
 * Point defence: each interceptable shot (missiles) gets one roll per working point-defence module on the target
 * ship, once it is PD_WINDOW of the way to its target (so modules stack). A module works when it is powered, intact,
 * not ion-struck and fully deployed, and the ship has a powered, intact AI core with its mast out to operate it.
 * Each module's turret tracks the incoming shots (the one it is engaging last wins).
 *
 * Shuttles: a missile homing on a shuttle is covered by the shuttle's home ship's point defence while the shuttle is
 * within VEHICLE_PD_RANGE of it. A hostile shuttle in flight within range of a defending ship, or docked at it, is an
 * incoming threat too: every VEHICLE_PD_INTERVAL ticks each working module rolls VEHICLE_PD_CHANCE to hit it for
 * VEHICLE_PD_DAMAGE hp.
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
    const defender = defenderGrid(sim, p.target);
    const guns = coreByGrid.get(defender) ? gunsByGrid.get(defender) ?? [] : [];
    for (const g of guns) track(sim, g, p.x, p.y);
    if (p.pdRolled || p.t < PD_WINDOW) continue;
    p.pdRolled = true;
    for (const g of guns) {
      if (!sim.rng.chance(PD_CHANCE)) continue;
      track(sim, g, p.x, p.y);
      sim.events.emit({ type: 'projectile.intercepted', projectile: id, weapon: p.weapon, gridId: defender });
      sim.world.destroyEntity(id);
      break;
    }
  }
  if (sim.tick % VEHICLE_PD_INTERVAL === 0) engageVehicles(sim, gunsByGrid, coreByGrid);
}

/** The grid whose point defence covers a shot's target: the ship itself, or a shuttle's home ship when it is close. */
function defenderGrid(sim: Sim, t: { gridId: number; vehicle?: number }): number {
  const v = t.vehicle ? sim.world.get(t.vehicle, VehicleC) : undefined;
  if (!t.vehicle) return t.gridId;
  const ship = v && shipOf(sim, v.homeGrid);
  if (!v || !ship || Math.hypot(v.x - (ship.x + ship.width / 2), v.y - (ship.y + ship.height / 2)) > VEHICLE_PD_RANGE) return 0;
  return v.homeGrid;
}

function engageVehicles(sim: Sim, gunsByGrid: Map<number, number[]>, coreByGrid: Map<number, boolean>): void {
  for (const vid of [...sim.world.query(VehicleC)]) {
    const v = sim.world.get(vid, VehicleC);
    if (!v || v.state === 'stowed') continue;
    const faction = vehicleFaction(sim, v);
    const dockedAt = v.state === 'docked' ? dockPoint(sim, v.dock)?.gridId : 0;
    for (const [gridId, guns] of gunsByGrid) {
      const ship = shipOf(sim, gridId);
      if (!ship || !coreByGrid.get(gridId) || ship.state === 'wreck' || ship.faction === faction || ship.faction === 'neutral' || faction === 'neutral') continue;
      const near = dockedAt === gridId || (v.state === 'flying'
        && Math.hypot(v.x - (ship.x + ship.width / 2), v.y - (ship.y + ship.height / 2)) <= VEHICLE_PD_RANGE);
      if (!near) continue;
      for (const g of guns) {
        track(sim, g, v.x, v.y);
        if (sim.rng.chance(VEHICLE_PD_CHANCE)) {
          damageVehicle(sim, vid, VEHICLE_PD_DAMAGE, 'pointDefence');
          if (!sim.world.get(vid, VehicleC)) break;
        }
      }
      if (!sim.world.get(vid, VehicleC)) break;
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
