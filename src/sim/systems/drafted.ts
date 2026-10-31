import { shipIdOf } from '../regions';
import { abortTask } from '../ai/task';
import { AssignmentC, CrewC, DraftedC, JobC, PathC, PositionC, type Drafted, type Path, type Position } from '../crew/components';
import { atJob, hasRoute, isIncapacitated, jobGoal, origin } from '../crew/helpers';
import { planWalk } from '../eva/route';
import type { Sim } from '../sim';
import { shipIdAt } from '../regions';

/** Drafted crew walk to their ordered target  and never take jobs. */
export function draftedSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, DraftedC, PositionC, PathC)) {
    if (isIncapacitated(sim, id)) continue;
    const drafted = sim.world.get(id, DraftedC) as Drafted;
    const target = drafted.target;
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as Path;
    const errand = sim.world.get(id, AssignmentC);
    if (errand) {
      // A suit errand ordered by the player: keep walking to it, replanning if the path was cut off.
      const job = sim.world.get(errand.jobId, JobC);
      if (job && path.steps.length === 0 && !hasRoute(sim, id) && !atJob(origin(pos), job)) {
        const plan = planWalk(sim, id, shipIdOf(sim, pos), origin(pos), jobGoal(job));
        if (plan) path.steps = plan.steps;
        else abortTask(sim, id, 'unreachable');
      }
      continue;
    }
    if (!target) continue;
    const o = origin(pos);
    const shipId = shipIdAt(sim, target.x, target.y) || shipIdOf(sim, pos); // open Space: stay on the crew member's own grid
    const planned = drafted.planned;
    if (hasRoute(sim, id)) {
      // Still walking: keep going while the route was planned for this target; a new target replans below.
      if (planned && planned.x === target.x && planned.y === target.y) continue;
    } else if (shipIdOf(sim, pos) === shipId && o.x === target.x && o.y === target.y) {
      drafted.target = null; // arrived
      delete drafted.planned;
      continue;
    }
    // Target changed (or the path was cleared): replan from where the current step ends. On the same grid the walk keeps
    // out of thin air when it can (the order still stands if only a thin-air route exists).
    const walk = shipId === shipIdOf(sim, pos) ? planWalk(sim, id, shipId, o, target) : null;
    if (walk) {
      path.steps = walk.steps;
      drafted.planned = { x: target.x, y: target.y };
      continue;
    }
    // No route (another ship's tile, or walled off): the order lapses.
    drafted.target = null;
    delete drafted.planned;
  }
}
