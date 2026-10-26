import { BodyC } from '../body';
import { IonC, PointDefenseC, ProjectileC } from '../combat/components';
import { aimDirection, moduleCenter } from '../combat/geometry';
import { ModuleC } from '../modules/components';
import { isDeployed } from '../modules/deploy';
import type { Sim } from '../sim';
import { PD_CHANCE, PD_WINDOW, VEHICLE_PD_CHANCE, VEHICLE_PD_DAMAGE, VEHICLE_PD_FLOOR, VEHICLE_PD_INTERVAL, VEHICLE_PD_RANGE } from '../tuning';
import { VehicleC } from '../vehicles/components';
import { dockPoint } from '../vehicles/geometry';
import { damageVehicle, vehicleDefOf, vehicleFaction } from '../vehicles/lifecycle';
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
 * VEHICLE_PD_DAMAGE hp, never below VEHICLE_PD_FLOOR of its max hp.
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
    const defender = defenderGrid(sim, p.target);
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
  if (sim.tick % VEHICLE_PD_INTERVAL === 0) engageVehicles(sim, gunsByGrid, coreByGrid);
}

/** The grid whose point defence covers a shot's target: the ship itself, or a shuttle's home ship when it is close. */
function defenderGrid(sim: Sim, t: { ship: number; vehicle?: number }): number {
  const v = t.vehicle ? sim.world.get(t.vehicle, VehicleC) : undefined;
  const b = t.vehicle ? sim.world.get(t.vehicle, BodyC) : undefined;
  if (!t.vehicle) return t.ship;
  const ship = v && shipById(sim, v.homeShip);
  if (!v || !b || !ship || Math.hypot(b.x - (ship.x + ship.width / 2), b.y - (ship.y + ship.height / 2)) > VEHICLE_PD_RANGE) return 0;
  return v.homeShip;
}

function engageVehicles(sim: Sim, gunsByGrid: Map<number, number[]>, coreByGrid: Map<number, boolean>): void {
  for (const vid of [...sim.world.query(VehicleC)]) {
    const v = sim.world.get(vid, VehicleC);
    const b = sim.world.get(vid, BodyC);
    if (!v || !b || v.state === 'stowed') continue;
    const faction = vehicleFaction(sim, v);
    const dockedAt = v.state === 'docked' ? dockPoint(sim, v.dock)?.shipId : 0;
    for (const [shipId, guns] of gunsByGrid) {
      const ship = shipById(sim, shipId);
      if (!ship || !coreByGrid.get(shipId) || ship.state === 'wreck' || ship.faction === faction || ship.faction === 'neutral' || faction === 'neutral') continue;
      const near = dockedAt === shipId || (v.state === 'flying'
        && Math.hypot(b.x - (ship.x + ship.width / 2), b.y - (ship.y + ship.height / 2)) <= VEHICLE_PD_RANGE);
      if (!near) continue;
      for (const g of guns) {
        track(sim, g, b.x, b.y);
        if (sim.rng.chance(VEHICLE_PD_CHANCE)) {
          // Point defence only chips: it never takes a shuttle below the floor.
          const floor = Math.ceil((vehicleDefOf(sim, v)?.maxHp ?? 0) * VEHICLE_PD_FLOOR);
          damageVehicle(sim, vid, Math.min(VEHICLE_PD_DAMAGE, v.hp - floor), 'pointDefence');
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
