import { CrewC, DraftedC, PathC, PositionC, type Drafted, type Position } from '../crew/components';
import { origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import type { Sim } from '../sim';

/** Drafted crew walk to their ordered target and never take jobs. */
export function draftedSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, DraftedC, PositionC, PathC)) {
    const drafted = sim.world.get(id, DraftedC) as Drafted;
    const target = drafted.target;
    if (!target) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as { steps: { x: number; y: number }[] };
    const o = origin(pos);
    const last = path.steps[path.steps.length - 1] ?? o;
    if (last.x === target.x && last.y === target.y) {
      if (path.steps.length === 0) drafted.target = null; // arrived
      continue;
    }
    // Target changed (or path was cleared): repath from where the current step ends.
    const steps = findPath(sim, pos.gridId, o, target);
    if (steps) path.steps = steps;
    else drafted.target = null;
  }
}
