import { CrewC, DraftedC, PathC, PositionC, type Crew, type Path, type Position } from '../crew/components';
import { facingOf, hasRoute, isIncapacitated, isSettled } from '../crew/helpers';
import { airlockDoorAt, requestAirlock } from '../portals/airlock';
import { isTileWalkable } from '../modules/walk';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { stat } from '../stats';
import { isSuited } from '../eva/suit';

/** Advance crew along their paths. Diagonal steps take sqrt(2) longer. */
export function movementSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PositionC, PathC)) {
    const crew = sim.world.get(id, CrewC) as Crew;
    if (crew.activity === 'sleeping' || isIncapacitated(sim, id)) continue;
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as Path;
    const grid = sim.grids.get(pos.gridId);
    if (!grid?.has('struct')) continue;
    const suited = isSuited(sim, id);
    const walk = (x: number, y: number): boolean => isTileWalkable(sim, grid, x, y, suited);

    if (!isSettled(pos) && !walk(pos.toX, pos.toY)) {
      // The tile we were stepping onto was built over: stop and let decide repath.
      pos.toX = pos.x;
      pos.toY = pos.y;
      pos.progress = 0;
      path.steps = [];
      delete path.then;
    }
    if (isSettled(pos)) {
      const next = path.steps[0];
      if (next) {
        const dx = next.x - pos.x;
        const dy = next.y - pos.y;
        const cutsCorner = dx !== 0 && dy !== 0 && (!walk(pos.x + dx, pos.y) || !walk(pos.x, pos.y + dy));
        const gate = airlockDoorAt(sim, grid, next.x, next.y);
        if (!walk(next.x, next.y) || cutsCorner || Math.max(Math.abs(dx), Math.abs(dy)) !== 1) {
          path.steps = [];
          delete path.then;
        } else if (gate && grid.get('door', next.x, next.y) < 255) {
          requestAirlock(sim, gate.id, gate.door); // wait here until the airlock has cycled to this side
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
    if (!isSettled(pos) || hasRoute(sim, id)) crew.activity = 'walking';
    else if (crew.activity === 'walking') crew.activity = sim.world.has(id, DraftedC) ? 'drafted' : 'idle';
  }
}
