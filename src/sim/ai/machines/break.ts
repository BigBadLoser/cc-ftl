import { BreakdownC, type Breakdown } from '../../crew/breakTypes';
import { ownedBedPlan } from '../../crew/beds';
import { PathC, type Path, type Position } from '../../crew/components';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath, type Tile } from '../../crew/pathfind';
import { fleePath } from '../../fight/flee';
import { isCombatReady, isHostile } from '../../fight/relations';
import { hiddenFrom } from '../../fight/rescue';
import type { Grid } from '../../grid';
import { isTileWalkable } from '../../modules/walk';
import { shipGrid, shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { BREAK_BED_RANGE } from '../../tuning';
import { CrewC, PositionC } from '../../crew/components';
import { TaskC } from '../components';
import { abortTask, setJoblessTask, setState } from '../task';

/**
 * The break machine (docs/TRAITS.md section 5, "Outcomes"): the behaviour of a break that takes the crew member over. It is a jobless
 * `hold` task started and stepped under the `breakdown` interrupt (owner executor), so the path it writes is the only one while the
 * break lasts. The crew member leaves it when `systems/breakdown.ts` ends the break, or while `hazard` takes them off a harmful tile
 * (the task is rebuilt from the `Breakdown` when the interrupt falls back to this one; nothing is stacked).
 *
 *   panic    Flee (away from the stressor's tile) then Cower    freeze  Freeze: stands still    hide  Hide: walks out of every hostile's sight
 *   tantrum  Sulk: stands where they are    despair  Walk to their own bed when it is near, then Lie (else Lie where they stand)
 */

/** Tiles around the crew member searched for a place out of sight. */
const HIDE_RADIUS = 12;

/** The first state of a break, from what it is. */
function startState(sim: Sim, id: number, pos: Position, b: Breakdown): string {
  switch (b.kind) {
    case 'panic': return 'Flee';
    case 'freeze': return 'Freeze';
    case 'hide': return 'Hide';
    case 'tantrum': return 'Sulk';
    default: return bedWalk(sim, id, pos) ? 'Walk' : 'Lie';
  }
}

/** The steps to the crew member's own bed when it is within BREAK_BED_RANGE tiles, else null. */
function bedWalk(sim: Sim, id: number, pos: Position): Tile[] | null {
  const plan = ownedBedPlan(sim, id, shipIdOf(sim, pos), origin(pos));
  return plan && plan.steps.length <= BREAK_BED_RANGE ? plan.steps : null;
}

/** Every hostile fit to fight on the crew member's grid (hiding is from what could see them, not only from what does now). */
function hostilePositions(sim: Sim, id: number, ship: number): Position[] {
  const out: Position[] = [];
  for (const o of sim.world.query(CrewC, PositionC)) {
    const p = sim.world.get(o, PositionC) as Position;
    if (o !== id && isHostile(sim, id, o) && isCombatReady(sim, o) && shipIdOf(sim, p) === ship) out.push(p);
  }
  return out;
}

/** The nearest walkable tile no hostile can see and none is close to, or null (already hidden, or nowhere to hide). */
function hiddenWalk(sim: Sim, id: number, grid: Grid, ship: number, pos: Position): Tile[] | null {
  const threats = hostilePositions(sim, id, ship);
  const from = origin(pos);
  if (threats.length === 0 || hiddenFrom(sim, grid, from, threats)) return null;
  for (let r = 1; r <= HIDE_RADIUS; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = from.x + dx, y = from.y + dy;
        if (!isTileWalkable(sim, grid, x, y) || !hiddenFrom(sim, grid, { x, y }, threats)) continue;
        const steps = findPath(sim, ship, from, { x, y });
        if (steps && steps.length > 0) return steps;
      }
    }
  }
  return null;
}

/** Where a walk planned now must start: the crew member's tile, or the end of the step they are in the middle of (that step stays at the head of the new path). */
function settledAt(pos: Position): { at: Position; head: Tile[] } {
  if (isSettled(pos)) return { at: pos, head: [] };
  const end = { x: pos.toX, y: pos.toY };
  return { at: { ...pos, ...end }, head: [end] };
}

/**
 * The break's turn for a crew member the interrupt layer holds with `breakdown`: make sure the task exists, plan the walk of a state that
 * needs one, and move on when it is done. A state with nothing to do stands still.
 */
export function breakTurn(sim: Sim, id: number, pos: Position): void {
  const b = sim.world.get(id, BreakdownC) as Breakdown;
  const path = sim.world.get(id, PathC) as Path;
  let task = sim.world.get(id, TaskC);
  if (!task || task.machine !== 'break') {
    // The break takes control over whatever task was there (a stray job or errand included): torn down through the one teardown, abortTask.
    abortTask(sim, id, 'breakdown');
    clearPath(sim, id);
    setJoblessTask(sim, id, 'idle', 'break', startState(sim, id, pos, b));
    task = sim.world.get(id, TaskC)!;
  }
  const grid = shipGrid(sim, shipIdOf(sim, pos));
  const planned = task.bb.n === 1;
  // Mid-step the movement system finishes the step in progress and then drops `steps[0]`: plan from where that step ends and keep it at the head.
  const { at, head } = settledAt(pos);
  switch (task.state) {
    case 'Flee': {
      if (!planned) {
        task.bb.n = 1;
        const here = origin(at);
        const steps = grid && fleePath(sim, grid, here, [b.src ?? here]);
        if (steps && steps.length > 0) path.steps = [...head, ...steps];
        else setState(sim, id, task, 'Cower');
      } else if (path.steps.length === 0 && isSettled(pos)) setState(sim, id, task, 'Cower');
      return;
    }
    case 'Hide': {
      if (!planned) {
        task.bb.n = 1;
        const steps = grid ? hiddenWalk(sim, id, grid, shipIdOf(sim, pos), at) : null;
        if (steps) path.steps = [...head, ...steps];
      }
      return;
    }
    case 'Walk': {
      if (!planned) {
        task.bb.n = 1;
        const steps = bedWalk(sim, id, at);
        if (steps) path.steps = [...head, ...steps];
      }
      if (path.steps.length === 0 && isSettled(pos)) setState(sim, id, task, 'Lie');
      return;
    }
    default: // Cower, Freeze, Sulk, Lie: stand (or lie) where they are
      clearPath(sim, id);
  }
}
