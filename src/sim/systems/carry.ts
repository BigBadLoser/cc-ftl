import {
  CarriedC, CrewC, DeadC, DownedC, PositionC, type Crew, type Position,
} from '../crew/components';
import type { Sim } from '../sim';

/**
 * A carried crew member rides on their carrier: their Position is copied from the carrier each
 * tick. If the carrier is gone, downed or dead (or the patient died), the carry ends and the
 * patient stays where they are.
 */
export function carrySystem(sim: Sim): void {
  for (const id of sim.world.query(CarriedC, PositionC)) {
    const carried = sim.world.get(id, CarriedC);
    const carrier = carried && sim.world.get(carried.carrier, PositionC);
    const ok =
      carried && carrier && sim.world.has(carried.carrier, CrewC) &&
      !sim.world.has(carried.carrier, DownedC) && !sim.world.has(carried.carrier, DeadC) &&
      sim.world.has(id, DownedC);
    if (!ok || !carrier) {
      sim.world.remove(id, CarriedC);
      const crew = sim.world.get(id, CrewC) as Crew | undefined;
      if (crew && sim.world.has(id, DownedC)) crew.activity = 'downed';
      continue;
    }
    const pos = sim.world.get(id, PositionC) as Position;
    pos.x = carrier.x;
    pos.y = carrier.y;
    pos.toX = carrier.toX;
    pos.toY = carrier.toY;
    pos.progress = carrier.progress;
    pos.facing = carrier.facing;
  }
}
