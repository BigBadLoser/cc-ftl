import type { Command } from '../commands';
import {
  applyChange, footprintFromGrid, widthViolations, type Footprint, type FootprintChange, type TileXY,
} from '../footprint';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { Struct } from '../structure';
import { JobC } from './components';
import { findJobAt } from './helpers';
import { BUILD_TICKS, DECONSTRUCT_TICKS, createJob } from './handlers';
import { ShipC } from '../combat/components';
import { wake } from '../combat/dormant';

/** Largest stroke one command may carry (a 120x80 ship is 9600 tiles). */
const MAX_STROKE = 12000;

/** The hull kinds a clear stroke may take down: everything crew can deconstruct. Rock and ground belong to the asteroid tools. */
const CLEARABLE: readonly number[] = [Struct.Floor, Struct.Wall, Struct.Door, Struct.Beam];

const keyOf = (t: TileXY): string => `${t.x},${t.y}`;

/**
 * Pending hull changes of a ship from queued area jobs: Space tiles that a build job will fill (`add`) and hull tiles that a
 * deconstruct-to-Space job will take down (`remove`). 
 */
function pendingChange(sim: Sim, ship: number): { add: TileXY[]; remove: TileXY[] } {
  const grid = shipGrid(sim, ship);
  const add: TileXY[] = [];
  const remove: TileXY[] = [];
  if (!grid) return { add, remove };
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (!j || shipIdOf(sim, j) !== ship || !grid.inBounds(j.x, j.y)) continue;
    const now = grid.get('struct', j.x, j.y);
    if (j.kind === 'build' && j.struct !== Struct.Space && now === Struct.Space) add.push({ x: j.x, y: j.y });
    else if (j.kind === 'deconstruct' && j.struct === Struct.Space && now !== Struct.Space) remove.push({ x: j.x, y: j.y });
  }
  return { add, remove };
}

/** The ship's footprint once every queued job is done. */
export function projectedFootprint(sim: Sim, ship: number): Footprint {
  const grid = shipGrid(sim, ship);
  if (!grid) return footprintFromGridless();
  return applyChange(footprintFromGrid(grid, ship), pendingChange(sim, ship));
}
const footprintFromGridless = (): Footprint => ({ x0: 0, y0: 0, w: 0, h: 0, data: new Uint8Array(0) });

/**
 * Width-rule violations a change would ADD to a footprint: tiles the opening drops after the change that it did not drop before.
 * Counting only new ones means a ship that already breaks the rule (an old template) can still be built on elsewhere.
 */
export function newViolations(before: Footprint, change: FootprintChange): TileXY[] {
  const old = new Set(widthViolations(before).map(keyOf));
  return widthViolations(before, change).filter((t) => !old.has(keyOf(t)));
}

/** What a stroke would do: the tiles that get a job, and why it is refused (`error`, with the offending tiles in `bad`). */
export interface StrokePlan {
  todo: TileXY[];
  bad: TileXY[];
  error: string | null;
}

/**
 * Judge a drag stroke without changing anything (the command handlers and the build tool's live preview share it). A 'build' stroke
 * fills the open-space tiles of `tiles` with Floor; a 'clear' stroke takes down the Floor/Wall/Door/Beam tiles. Tiles that need
 * nothing (hull already there, or a job already on them) are skipped. The whole stroke is judged at once against the width rule,
 * counting queued jobs as done.
 */
export function planStroke(sim: Sim, ship: number, mode: 'build' | 'clear', tiles: readonly TileXY[]): StrokePlan {
  const refuse = (error: string, bad: TileXY[] = []): StrokePlan => ({ todo: [], bad, error });
  const grid = shipGrid(sim, ship);
  if (!grid?.has('struct')) return refuse('badGrid');
  if (tiles.length > MAX_STROKE) return refuse('tooBig');
  const seen = new Set<string>();
  const all: TileXY[] = [];
  for (const t of tiles) {
    if (seen.has(keyOf(t))) continue;
    seen.add(keyOf(t));
    all.push({ x: t.x, y: t.y });
  }
  const outside = all.filter((t) => !grid.inBounds(t.x, t.y));
  if (outside.length) return refuse('outOfBounds', outside);
  let todo: TileXY[];
  if (mode === 'build') {
    // Only open space takes new hull; tiles that hold hull (or already have a job) are left alone, so a stroke may cross the ship.
    todo = all.filter((t) => grid.get('struct', t.x, t.y) === Struct.Space && !findJobAt(sim, ship, t.x, t.y));
    if (todo.length === 0) return refuse('sameStruct');
  } else {
    const hull = all.filter((t) => grid.get('struct', t.x, t.y) !== Struct.Space);
    const unclearable = hull.filter((t) => !CLEARABLE.includes(grid.get('struct', t.x, t.y)));
    if (unclearable.length) return refuse('badKind', unclearable);
    const modules = hull.filter((t) => grid.get('module', t.x, t.y));
    if (modules.length) return refuse('moduleHere', modules);
    todo = hull.filter((t) => !findJobAt(sim, ship, t.x, t.y));
    if (todo.length === 0) return refuse('nothingToDeconstruct');
  }
  const bad = newViolations(projectedFootprint(sim, ship), mode === 'build' ? { add: todo } : { remove: todo });
  return bad.length ? { todo, bad, error: 'narrowHull' } : { todo, bad, error: null };
}

/** An outpost the player builds into is provoked, as with `job.build`. */
function provoke(sim: Sim, ship: number): void {
  if (sim.world.get(ship, ShipC)?.outpost) wake(sim, ship, 'dug');
}

function run(sim: Sim, cmd: Extract<Command, { type: 'job.buildArea' | 'job.clearArea' }>): void {
  const build = cmd.type === 'job.buildArea';
  const plan = planStroke(sim, cmd.ship, build ? 'build' : 'clear', cmd.tiles);
  if (plan.error) return sim.events.emit({ type: 'command.rejected', command: cmd.type, reason: plan.error });
  provoke(sim, cmd.ship);
  for (const t of plan.todo) {
    if (build) createJob(sim, 'build', cmd.ship, t.x, t.y, Struct.Floor, BUILD_TICKS[Struct.Floor] as number, false, { area: true });
    else createJob(sim, 'deconstruct', cmd.ship, t.x, t.y, Struct.Space, DECONSTRUCT_TICKS, false, { area: true });
  }
}

export const buildArea = (sim: Sim, cmd: Extract<Command, { type: 'job.buildArea' }>): void => run(sim, cmd);
export const clearArea = (sim: Sim, cmd: Extract<Command, { type: 'job.clearArea' }>): void => run(sim, cmd);

/**
 * Re-check at completion: would the hull, once every queued job is done, have a narrow part near this tile that it does not have
 * now? Queued jobs count as done because their order is up to the crew (a 3x3 block is narrow until its last tile lands), so a
 * normal stroke always passes; a stroke whose partner jobs were cancelled since it was accepted shows up as new violations around
 * its tile. Violations the ship already has are not held against the job, and neither are distant ones (radius 2 is the opening's reach).
 */
export function completionBreaksWidth(sim: Sim, ship: number, tile: TileXY): boolean {
  const grid = shipGrid(sim, ship);
  if (!grid) return false;
  const old = new Set(widthViolations(footprintFromGrid(grid, ship)).map(keyOf));
  return widthViolations(projectedFootprint(sim, ship)).some((t) => !old.has(keyOf(t)) && Math.abs(t.x - tile.x) <= 2 && Math.abs(t.y - tile.y) <= 2);
}
