import { CrewC, DraftedC, PathC, PositionC, type Drafted, type Path, type Position } from '../crew/components';
import { hasRoute, isIncapacitated, origin } from '../crew/helpers';
import { planRoute } from '../portals/route';
import type { Sim } from '../sim';

/** Drafted crew walk to their ordered target (across grids, through portals) and never take jobs. */
export function draftedSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, DraftedC, PositionC, PathC)) {
    if (isIncapacitated(sim, id)) continue;
    const drafted = sim.world.get(id, DraftedC) as Drafted;
    const target = drafted.target;
    if (!target) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as Path;
    const o = origin(pos);
    const gridId = target.gridId ?? pos.gridId;
    const planned = drafted.planned;
    if (hasRoute(sim, id)) {
      // Still walking: keep going while the route was planned for this target; a new target replans below.
      if (planned && planned.x === target.x && planned.y === target.y && planned.gridId === gridId) continue;
    } else if (pos.gridId === gridId && o.x === target.x && o.y === target.y) {
      drafted.target = null; // arrived
      delete drafted.planned;
      continue;
    }
    // Target changed (or the path was cleared): replan from where the current step ends.
    const route = planRoute(sim, id, { gridId: pos.gridId, ...o }, { gridId, x: target.x, y: target.y });
    if (route) {
      path.steps = route.steps;
      if (route.then.length > 0) path.then = route.then;
      else delete path.then;
      drafted.planned = { x: target.x, y: target.y, gridId };
    } else {
      drafted.target = null;
      delete drafted.planned;
    }
  }
}
