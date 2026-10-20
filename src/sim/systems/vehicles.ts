import { ALT, BodyC, type Body } from '../body';
import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated, isSettled } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { airlockWorking } from '../modules/airlock';
import type { Sim } from '../sim';
import { EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { bayCenter, boardingTile, dockPoint } from '../vehicles/geometry';
import { boardCrew, destPoint, occupants, undock, vehicleDefOf, vehicleLostWithBay, vehicleSpeedPerTick } from '../vehicles/lifecycle';
import { gridIdOf, shipIdOf } from '../regions';

/**
 * Vehicles. (1) Crew with an embark order who stand on the vehicle's boarding tile climb in (hidden, off the grid).
 * (2) Bodies: a stowed vehicle's is pinned to its bay centre at deck altitude (lost with the bay if it is destroyed); a docked
 * one's to its airlock's dock point (it breaks away when the airlock is gone); a flying one flies a straight line to its
 * destination at cruise altitude, at content speed, faster with the pilot's piloting skill, and docks or stows on arrival.
 * Runs after movement so crew arrive and board the same tick.
 */
export function vehicleSystem(sim: Sim): void {
  for (const crew of sim.world.query(EmbarkOrderC)) {
    const order = sim.world.get(crew, EmbarkOrderC);
    const v = order && sim.world.get(order.vehicle, VehicleC);
    const pos = sim.world.get(crew, PositionC);
    const at = order && boardingTile(sim, order.vehicle);
    const drafted = sim.world.get(crew, DraftedC);
    if (!order || !v || !pos || !at || !drafted || !sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC) || isIncapacitated(sim, crew)) {
      sim.world.remove(crew, EmbarkOrderC);
      continue;
    }
    if (isSettled(pos) && gridIdOf(sim, pos) === at.gridId && pos.x === at.x && pos.y === at.y) {
      sim.world.remove(crew, EmbarkOrderC);
      if (occupants(v).length < (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) boardCrew(sim, crew, order.vehicle);
      else sim.events.emit({ type: 'command.rejected', command: 'vehicle.embark', reason: 'full' });
    } else if (!drafted.target) {
      sim.world.remove(crew, EmbarkOrderC); // gave up: unreachable
    }
  }

  for (const id of sim.world.query(VehicleC, BodyC)) {
    const v = sim.world.get(id, VehicleC);
    const b = sim.world.get(id, BodyC);
    if (!v || !b) continue;
    if (v.state === 'stowed') {
      const bay = sim.world.get(v.home, ModuleC);
      if (!bay || bay.hp <= 0) {
        vehicleLostWithBay(sim, id);
        continue;
      }
      const c = bayCenter(sim, v.home);
      if (c) [b.x, b.y] = [c.x, c.y];
      b.alt = ALT.stowed;
    } else if (v.state === 'docked') {
      const p = dockPoint(sim, v.dock);
      if (p) [b.x, b.y, b.alt] = [p.x, p.y, ALT.docked];
      else undock(sim, id, v);
    }
    if (v.state === 'flying') {
      b.alt = ALT.cruise;
      if (v.dest) fly(sim, id, v, b);
    }
  }
}

function fly(sim: Sim, id: number, v: Vehicle, b: Body): void {
  const dest = v.dest;
  const to = destPoint(sim, v, b);
  if (!dest || !to || (dest.type === 'dock' && !airlockWorking(sim, dest.airlock))) {
    v.dest = null; // target gone or its airlock failed: hover
    return;
  }
  const dx = to.x - b.x;
  const dy = to.y - b.y;
  const dist = Math.hypot(dx, dy);
  const step = vehicleSpeedPerTick(sim, v);
  if (dist > 0.0001) b.heading = Math.atan2(dy, dx);
  if (dist > step) {
    b.x += (dx / dist) * step;
    b.y += (dy / dist) * step;
    return;
  }
  b.x = to.x;
  b.y = to.y;
  v.dest = null;
  if (dest.type === 'dock') {
    v.state = 'docked';
    v.dock = dest.airlock;
    b.alt = ALT.docked;
    sim.events.emit({ type: 'vehicle.docked', vehicle: id, ship: shipIdOf(sim, sim.world.get(dest.airlock, ModuleC)), airlock: dest.airlock });
  } else if (dest.type === 'hover') {
    v.hover = dest.ship;
  } else {
    v.state = 'stowed';
    b.alt = ALT.stowed;
    sim.events.emit({ type: 'vehicle.stowed', vehicle: id, bay: v.home });
  }
}
