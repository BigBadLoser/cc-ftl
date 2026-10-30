import { ammoCount, consumeAmmo } from '../../combat/ammo';
import { CrewC, EatC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { foodOn } from '../../crew/eating';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { findPath, type Tile } from '../../crew/pathfind';
import { StorageC } from '../../items/components';
import { dropCarried } from '../../items/stacks';
import { storageCount } from '../../items/storage';
import { ModuleC } from '../../modules/components';
import { accessTile } from '../../modules/footprint';
import { shipIdOf } from '../../regions';
import type { Sim } from '../../sim';
import { TICK_HZ } from '../../time';
import { EAT_SEC } from '../../tuning';
import { abortTask, syncTask } from '../task';

/**
 * The eat machine (docs/CREW_AI.md section 6): `Walk` to a spot (a galley, else a crate with food), then `Consume` (activity
 * 'eating'; the needs system counts the meal down and ends it). Phase 1: `EatC` stays the saved truth (`left` -1 while walking).
 */

/** The eat drive's turn: true while the crew member is busy with a meal (the task mirrors it), false to carry on as usual. */
export function eatTurn(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  if (!goEat(sim, id, crew, pos)) return false;
  syncTask(sim, id);
  return true;
}

/** The meal is over (the needs system fed them): the task ends. */
export function finishMeal(sim: Sim, id: number): void {
  sim.world.remove(id, EatC);
  (sim.world.get(id, CrewC) as Crew).activity = 'idle';
  syncTask(sim, id);
}

/** An interrupted meal is dropped (drafted, or no longer eating): the ration already taken is lost. */
export function dropMeal(sim: Sim, id: number): void {
  sim.world.remove(id, EatC);
  syncTask(sim, id);
}

/** Where to eat: the nearest working galley's access tile, else a walkable tile beside the nearest crate holding `item`. */
function pickSpot(sim: Sim, shipId: number, from: Tile, item: string): { x: number; y: number; galley: boolean; steps: Tile[] } | null {
  let galley: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  let crate: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== shipId || m.hp <= 0) continue;
    if (def.galley && m.enabled && m.powered) {
      const at = accessTile(def, m.x, m.y, m.rot);
      const steps = at && findPath(sim, shipId, from, at);
      if (at && steps && (!galley || steps.length < galley.steps.length)) galley = { x: at.x, y: at.y, galley: true, steps };
    } else if (def.storage && sim.world.has(id, StorageC) && storageCount(sim, id, item) > 0) {
      const steps = findPath(sim, shipId, from, { x: m.x, y: m.y, adjacent: true });
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
  let eat = sim.world.get(id, EatC);
  if (eat && eat.left >= 0) return true;
  const item = eat?.item && ammoCount(sim, shipIdOf(sim, pos), eat.item) > 0 ? eat.item : foodOn(sim, shipIdOf(sim, pos));
  if (!item) {
    sim.world.remove(id, EatC);
    return false;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (!eat) {
    if ((sim.tick + id) % 20 !== 0) return false; // look for a spot once a second, not every tick
    const spot = pickSpot(sim, shipIdOf(sim, pos), origin(pos), item);
    if (!spot) return false;
    abortTask(sim, id, 'drive');
    dropCarried(sim, id);
    sim.world.add(id, EatC, (eat = { x: spot.x, y: spot.y, galley: spot.galley, item, left: -1 }));
    path.steps = spot.steps;
  }
  if (!isSettled(pos) || path.steps.length > 0) return true; // still walking
  if (pos.x === eat.x && pos.y === eat.y) {
    if (!consumeAmmo(sim, shipIdOf(sim, pos), item)) {
      sim.world.remove(id, EatC);
      return false;
    }
    eat.item = item;
    eat.left = Math.round(EAT_SEC * TICK_HZ);
    clearPath(sim, id);
    crew.activity = 'eating';
    return true;
  }
  const steps = findPath(sim, shipIdOf(sim, pos), origin(pos), { x: eat.x, y: eat.y });
  if (!steps || steps.length === 0) {
    sim.world.remove(id, EatC);
    return false;
  }
  path.steps = steps;
  return true;
}
