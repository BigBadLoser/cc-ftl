import { consumeAmmo, hasStock } from '../../combat/ammo';
import { CrewC, PathC, type Crew, type Path, type Position } from '../../crew/components';
import { bondedPeers, socialCost } from '../../crew/bondSpot';
import { foodOn } from '../../crew/eating';
import { clearPath, isSettled, origin } from '../../crew/helpers';
import { hopField, hopsBeside, type Hops } from '../../crew/hops';
import { findPath, type Tile } from '../../crew/pathfind';
import { walkOpts } from '../../eva/route';
import { StorageC } from '../../items/components';
import { dropCarried } from '../../items/stacks';
import { storageCount } from '../../items/storage';
import { ModuleC, type Module } from '../../modules/components';
import { modulesOn } from '../../modules/byShip';
import { accessTile } from '../../modules/footprint';
import { shipIdOf } from '../../regions';
import type { ModuleDef } from '../../registry';
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

/**
 * The eat drive's turn: true while the crew member is busy with a meal (the task mirrors it), false when no meal can start (no food, no spot
 * in reach), `'later'` while the search for a spot waits for its tick (once a second): a meal may yet start, so no lower need takes the turn.
 */
export function eatTurn(sim: Sim, id: number, crew: Crew, pos: Position): boolean | 'later' {
  const r = goEat(sim, id, crew, pos);
  if (r !== true) return r;
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

/** Could a meal start now: food aboard and a spot (a working galley or a crate with it) the crew member can reach? (A sleeper is woken for it only then.) */
export function canStartMeal(sim: Sim, id: number, pos: Position): boolean {
  const shipId = shipIdOf(sim, pos);
  const item = foodOn(sim, shipId);
  return !!item && !!pickSpot(sim, id, shipId, origin(pos), item);
}

/**
 * Where to eat: the nearest working galley's access tile, else a walkable tile beside the nearest crate holding `item` (never a tile that harms
 * the eater). Galleys are searched first and crates only when none is reached, and a spot whose walk cannot beat the best so far is not
 * searched: its Chebyshev distance bounds the steps, then the fewest moves to it over the same walk (crew/hops.ts, one flood for every spot;
 * -1 is no walk at all), and friends close by take at most 3 each off the company term. The same spot as searching every galley and crate in
 * id order, without a walk per crate on a big station whose winding decks make the straight-line bound useless.
 */
function pickSpot(sim: Sim, crew: number, shipId: number, from: Tile, item: string): { x: number; y: number; galley: boolean; steps: Tile[] } | null {
  type Spot = { x: number; y: number; galley: boolean; steps: Tile[]; cost: number };
  let galley: Spot | null = null;
  let crate: Spot | null = null;
  const peers = bondedPeers(sim, crew); // friends sit together, rivals keep apart: a spot's cost is its walk plus the company there
  const social = -3 * peers.filter((p) => p.friend).length; // the lowest the company term can be (socialCost: -3 per friend near)
  const cheb = (x: number, y: number): number => Math.max(Math.abs(x - from.x), Math.abs(y - from.y));
  const mods = modulesOn(sim, shipId, null); // the modules of the ship with a def, ascending ids (a scan of every module, by ship)
  const usable = (id: number): { m: Module; def: ModuleDef } | null => {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    return m && def && m.hp > 0 ? { m, def } : null;
  };
  const opts = walkOpts(sim, crew);
  let walkHops: Hops | null | undefined, plainHops: Hops | null | undefined; // built on first use: galleys walk with the crew member's options
  for (const id of mods) {
    const u = usable(id);
    if (!u || !(u.def.galley && u.m.enabled && u.m.powered)) continue;
    const { m, def } = u;
    const at = accessTile(def, m.x, m.y, m.rot);
    if (at && galley && cheb(at.x, at.y) + social >= galley.cost) continue; // cannot be nearer than the best galley
    if (at && walkHops === undefined) walkHops = hopField(sim, shipId, from, opts);
    const hops = at && walkHops ? walkHops(at.x, at.y) : 0;
    if (hops < 0 || (galley && hops + social >= galley.cost)) continue; // no walk there, or none short enough
    const steps = at && !unsafeFor(sim, crew, shipId, at.x, at.y) && findPath(sim, shipId, from, at, opts);
    const cost = steps && at ? steps.length + socialCost(sim, peers, shipId, at.x, at.y) : 0;
    if (at && steps && (!galley || cost < galley.cost)) galley = { x: at.x, y: at.y, galley: true, steps, cost };
  }
  if (galley) return galley;
  for (const id of mods) {
    const u = usable(id);
    if (!u || (u.def.galley && u.m.enabled && u.m.powered)) continue;
    const { m, def } = u;
    if (!def.storage || !sim.world.has(id, StorageC) || storageCount(sim, id, item) <= 0) continue;
    if (crate && Math.max(0, cheb(m.x, m.y) - 1) + social >= crate.cost) continue; // every stop beside it is at least this far
    if (plainHops === undefined) plainHops = hopField(sim, shipId, from);
    const hops = plainHops ? hopsBeside(plainHops, m.x, m.y) : 0;
    if (hops < 0 || (crate && hops + social >= crate.cost)) continue;
    const steps = safePathBeside(sim, crew, shipId, from, m.x, m.y);
    const end = steps && (steps[steps.length - 1] ?? from);
    const cost = steps && end ? steps.length + socialCost(sim, peers, shipId, end.x, end.y) : 0;
    if (steps && end && (!crate || cost < crate.cost)) crate = { x: end.x, y: end.y, galley: false, steps, cost };
  }
  return crate;
}

/**
 * Drive a hungry crew member's meal: pick a spot (galley, else a crate with food), walk there, take a ration from storage
 * and start eating (activity 'eating'; the needs system finishes the meal). Returns true while the crew member is busy
 * with it, false when there is no food or no reachable spot (they carry on as usual and try again later).
 * Starting a trip drops the current job and any load.
 */
function goEat(sim: Sim, id: number, crew: Crew, pos: Position): boolean | 'later' {
  let meal = mealOf(sim, id);
  if (meal && (meal.bb.n ?? -1) >= 0) return true;
  const want = meal?.bb.item;
  const item = want && hasStock(sim, shipIdOf(sim, pos), want) ? want : foodOn(sim, shipIdOf(sim, pos));
  if (!item) {
    endMeal(sim, id);
    return false;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (!meal) {
    if ((sim.tick + id) % 20 !== 0) return 'later'; // look for a spot once a second, not every tick
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
