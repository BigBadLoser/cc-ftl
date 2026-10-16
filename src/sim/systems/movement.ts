import { CrewC, DraftedC, PathC, PositionC, type Crew, type Path, type Position } from '../crew/components';
import { facingOf, isIncapacitated, isSettled } from '../crew/helpers';
import { isTileWalkable } from '../modules/walk';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { stat } from '../stats';

/** Advance crew along their paths. Diagonal steps take sqrt(2) longer. */
export function movementSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PositionC, PathC)) {
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity === 'sleeping' || isIncapacitated(sim, id)) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as Path;
    const grid = sim.grids.get(pos.gridId);
    if (!grid?.has('struct')) continue;
    const walk = (x: number, y: number): boolean => isTileWalkable(sim, grid, x, y);

    if (!isSettled(pos) && !walk(pos.toX, pos.toY)) {
      // The tile we were stepping onto was built over: stop and let decide repath.
      pos.toX = pos.x;
      pos.toY = pos.y;
      pos.progress = 0;
      path.steps = [];
    }
    if (isSettled(pos)) {
      const next = path.steps[0];
      if (next) {
        const dx = next.x - pos.x;
        const dy = next.y - pos.y;
        const cutsCorner = dx !== 0 && dy !== 0 && (!walk(pos.x + dx, pos.y) || !walk(pos.x, pos.y + dy));
        if (!walk(next.x, next.y) || cutsCorner || Math.max(Math.abs(dx), Math.abs(dy)) !== 1) {
          path.steps = [];
        } else {
          pos.toX = next.x;
          pos.toY = next.y;
          pos.progress = 0;
          pos.facing = facingOf(dx, dy, pos.facing);
        }
      }
    }
    if (!isSettled(pos)) {
      const diagonal = pos.toX !== pos.x && pos.toY !== pos.y;
      pos.progress += stat(sim, id, 'moveSpeed') / TICK_HZ / (diagonal ? Math.SQRT2 : 1);
      if (pos.progress >= 1) {
        pos.x = pos.toX;
        pos.y = pos.toY;
        pos.progress = 0;
        path.steps.shift();
      }
    }
    if (!isSettled(pos) || path.steps.length > 0) crew.activity = 'walking';
    else if (crew.activity === 'walking') crew.activity = sim.world.has(id, DraftedC) ? 'drafted' : 'idle';
  }
}
