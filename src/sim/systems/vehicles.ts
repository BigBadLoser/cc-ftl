import { CrewC, DeadC, DraftedC, PositionC } from '../crew/components';
import { isIncapacitated, isSettled } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import { airlockWorking } from '../portals/airlock';
import type { Sim } from '../sim';
import { EmbarkOrderC, VehicleC, type Vehicle } from '../vehicles/components';
import { bayCenter, boardingTile, dockPoint } from '../vehicles/geometry';
import { boardCrew, destPoint, occupants, undock, vehicleDefOf, vehicleLostWithBay, vehicleSpeedPerTick } from '../vehicles/lifecycle';

/**
 * Vehicles. (1) Crew with an embark order who stand on the vehicle's boarding tile climb in (hidden, off the grid).
 * (2) Stowed vehicles follow their bay (and are lost with it if it is destroyed); docked ones follow their airlock
 * (and break away when it is gone); flying ones fly a straight line to their destination at content speed, faster with
 * the pilot's piloting skill, and dock or stow on arrival. Runs after movement so crew arrive and board the same tick.
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
    if (isSettled(pos) && pos.gridId === at.gridId && pos.x === at.x && pos.y === at.y) {
      sim.world.remove(crew, EmbarkOrderC);
      if (occupants(v).length < (vehicleDefOf(sim, v)?.capacity ?? 0) + 1) boardCrew(sim, crew, order.vehicle);
      else sim.events.emit({ type: 'command.rejected', command: 'vehicle.embark', reason: 'full' });
    } else if (!drafted.target) {
      sim.world.remove(crew, EmbarkOrderC); // gave up: unreachable
    }
  }

  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    if (!v) continue;
    if (v.state === 'stowed') {
      const bay = sim.world.get(v.home, ModuleC);
      if (!bay || bay.hp <= 0) {
        vehicleLostWithBay(sim, id);
        continue;
      }
      const c = bayCenter(sim, v.home);
      if (c) [v.x, v.y] = [c.x, c.y];
    } else if (v.state === 'docked') {
      const p = dockPoint(sim, v.dock);
      if (!p) undock(sim, id, v);
      else [v.x, v.y] = [p.x, p.y];
    } else if (v.dest) {
      fly(sim, id, v);
    }
  }
}

function fly(sim: Sim, id: number, v: Vehicle): void {
  const dest = v.dest;
  const to = destPoint(sim, v);
  if (!dest || !to || (dest.type === 'dock' && !airlockWorking(sim, dest.airlock))) {
    v.dest = null; // target gone or its airlock failed: hover
    return;
  }
  const dx = to.x - v.x;
  const dy = to.y - v.y;
  const dist = Math.hypot(dx, dy);
  const step = vehicleSpeedPerTick(sim, v);
  if (dist > 0.0001) v.heading = Math.atan2(dy, dx);
  if (dist > step) {
    v.x += (dx / dist) * step;
    v.y += (dy / dist) * step;
    return;
  }
  v.x = to.x;
  v.y = to.y;
  v.dest = null;
  if (dest.type === 'dock') {
    const gridId = sim.world.get(dest.airlock, ModuleC)?.gridId ?? 0;
    v.state = 'docked';
    v.dock = dest.airlock;
    sim.events.emit({ type: 'vehicle.docked', vehicle: id, gridId, airlock: dest.airlock });
  } else if (dest.type === 'hover') {
    v.hover = dest.gridId;
  } else {
    v.state = 'stowed';
    sim.events.emit({ type: 'vehicle.stowed', vehicle: id, bay: v.home });
  }
}
