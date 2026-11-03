import { ammoCount, consumeAmmo } from '../../combat/ammo';
import { CrewC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { foodOn } from '../../crew/eating';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath, type Tile } from '../../crew/pathfind';
import { walkOpts } from '../../eva/route';
import { StorageC } from '../../items/components';
import { dropCarried } from '../../items/stacks';
import { storageCount } from '../../items/storage';
import { ModuleC } from '../../modules/components';
import { accessTile } from '../../modules/footprint';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TICK_HZ } from '../../time';
import { EAT_SEC } from '../../tuning';
import { safePathBeside, unsafeFor } from '../hazard';
import { abortTask, endMeal, mealOf, startMeal, syncTask } from '../task';

/**
 * The eat machine (docs/CREW_AI.md section 6): `Walk` to a spot (a galley, else a crate with food), then `Consume` (activity
 * 'eating'; the needs system counts the meal down and ends it). The task is the meal: `tile` the spot, `hot` at a galley (not at a
 * crate), `item` the ration, `n` the ticks left (-1 while walking).
 */

/** The eat drive's turn: true while the crew member is busy with a meal (the task mirrors it), false to carry on as usual. */
export function eatTurn(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  if (!goEat(sim, id, crew, pos)) return false;
  syncTask(sim, id);
  return true;
}

/** The meal is over (the needs system fed them): the task ends. */
export function finishMeal(sim: Sim, id: number): void {
  endMeal(sim, id);
  (sim.world.get(id, CrewC) as Crew).activity = 'idle';
  syncTask(sim, id);
}

/** An interrupted meal is dropped (drafted, or no longer eating): the ration already taken is lost. */
export function dropMeal(sim: Sim, id: number): void {
  endMeal(sim, id);
  syncTask(sim, id);
}

/** Where to eat: the nearest working galley's access tile, else a walkable tile beside the nearest crate holding `item` (never a tile that harms the eater). */
function pickSpot(sim: Sim, crew: number, shipId: number, from: Tile, item: string): { x: number; y: number; galley: boolean; steps: Tile[] } | null {
  let galley: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  let crate: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== shipId || m.hp <= 0) continue;
    if (def.galley && m.enabled && m.powered) {
      const at = accessTile(def, m.x, m.y, m.rot);
      const steps = at && !unsafeFor(sim, crew, shipId, at.x, at.y) && findPath(sim, shipId, from, at, walkOpts(sim, crew));
      if (at && steps && (!galley || steps.length < galley.steps.length)) galley = { x: at.x, y: at.y, galley: true, steps };
    } else if (def.storage && sim.world.has(id, StorageC) && storageCount(sim, id, item) > 0) {
      const steps = safePathBeside(sim, crew, shipId, from, m.x, m.y);
      if (steps && (!crate || steps.length < crate.steps.length)) {
        const end = steps[steps.length - 1] ?? from;
        crate = { x: end.x, y: end.y, galley: false, steps };
      }
    }
  }
  return galley ?? crate;
}

/**
 * Drive a hungry crew member's meal: pick a spot (galley, else a crate with food), walk there, take a ration from storage
 * and start eating (activity 'eating'; the needs system finishes the meal). Returns true while the crew member is busy
 * with it, false when there is no food or no reachable spot (they carry on as usual and try again later).
 * Starting a trip drops the current job and any load.
 */
function goEat(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  let meal = mealOf(sim, id);
  if (meal && (meal.bb.n ?? -1) >= 0) return true;
  const want = meal?.bb.item;
  const item = want && ammoCount(sim, shipIdOf(sim, pos), want) > 0 ? want : foodOn(sim, shipIdOf(sim, pos));
  if (!item) {
    endMeal(sim, id);
    return false;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (!meal) {
    if ((sim.tick + id) % 20 !== 0) return false; // look for a spot once a second, not every tick
    const spot = pickSpot(sim, id, shipIdOf(sim, pos), origin(pos), item);
    if (!spot) return false;
    abortTask(sim, id, 'drive');
    dropCarried(sim, id);
    meal = startMeal(sim, id, { x: spot.x, y: spot.y }, spot.galley, item);
    path.steps = spot.steps;
  }
  const at = meal.bb.tile as { x: number; y: number };
  if (unsafeFor(sim, id, shipIdOf(sim, pos), at.x, at.y)) {
    endMeal(sim, id); // the spot now harms them: look again later
    clearPath(sim, id);
    return false;
  }
  if (!isSettled(pos) || path.steps.length > 0) return true; // still walking
  if (pos.x === at.x && pos.y === at.y) {
    if (!consumeAmmo(sim, shipIdOf(sim, pos), item)) {
      endMeal(sim, id);
      return false;
    }
    meal.bb.item = item;
    meal.bb.n = Math.round(EAT_SEC * TICK_HZ);
    clearPath(sim, id);
    crew.activity = 'eating';
    return true;
  }
  const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: at.x, y: at.y }, walkOpts(sim, id));
  if (!steps || steps.length === 0) {
    endMeal(sim, id);
    return false;
  }
  path.steps = steps;
  return true;
}
