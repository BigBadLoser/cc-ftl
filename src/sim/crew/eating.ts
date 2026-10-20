import { ammoCount, consumeAmmo } from '../combat/ammo';
import { dropCarried } from '../items/stacks';
import { StorageC } from '../items/components';
import { storageCount } from '../items/storage';
import { accessTile } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EAT_SEC, HUNGER_EAT_BELOW, HUNGER_EAT_URGENT } from '../tuning';
import { EatC, NeedsC, PathC, type Crew, type Path, type Position } from './components';
import { clearPath, isSettled, origin, releaseAssignment } from './helpers';
import { findPath, type Tile } from './pathfind';
import { gridIdOf } from '../regions';

/** The food item (an item def with `food`) of which the grid's storage holds the most nutritious unit, or null. */
export function foodOn(sim: Sim, gridId: number): string | null {
  let best: string | null = null;
  let nutrition = 0;
  for (const [item, def] of Object.entries(sim.content.items)) {
    if (def.food && def.food.nutrition > nutrition && ammoCount(sim, gridId, item) > 0) [best, nutrition] = [item, def.food.nutrition];
  }
  return best;
}

/** True when the crew member is hungry enough to stop work and eat (operators hold their post until it is urgent). */
export function wantsToEat(sim: Sim, id: number, operating: boolean): boolean {
  const hunger = sim.world.get(id, NeedsC)?.hunger;
  return hunger !== undefined && hunger < (operating ? HUNGER_EAT_URGENT : HUNGER_EAT_BELOW);
}

/** Where to eat: the nearest working galley's access tile, else a walkable tile beside the nearest crate holding `item`. */
function pickSpot(sim: Sim, gridId: number, from: Tile, item: string): { x: number; y: number; galley: boolean; steps: Tile[] } | null {
  let galley: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  let crate: { x: number; y: number; galley: boolean; steps: Tile[] } | null = null;
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || gridIdOf(sim, m) !== gridId || m.hp <= 0) continue;
    if (def.galley && m.enabled && m.powered) {
      const at = accessTile(def, m.x, m.y, m.rot);
      const steps = at && findPath(sim, gridId, from, at);
      if (at && steps && (!galley || steps.length < galley.steps.length)) galley = { x: at.x, y: at.y, galley: true, steps };
    } else if (def.storage && sim.world.has(id, StorageC) && storageCount(sim, id, item) > 0) {
      const steps = findPath(sim, gridId, from, { x: m.x, y: m.y, adjacent: true });
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
export function goEat(sim: Sim, id: number, crew: Crew, pos: Position): boolean {
  let eat = sim.world.get(id, EatC);
  if (eat && eat.left >= 0) return true;
  const item = eat?.item && ammoCount(sim, pos.gridId, eat.item) > 0 ? eat.item : foodOn(sim, pos.gridId);
  if (!item) {
    sim.world.remove(id, EatC);
    return false;
  }
  const path = sim.world.get(id, PathC) as Path;
  if (!eat) {
    if ((sim.tick + id) % 20 !== 0) return false; // look for a spot once a second, not every tick
    const spot = pickSpot(sim, pos.gridId, origin(pos), item);
    if (!spot) return false;
    releaseAssignment(sim, id);
    dropCarried(sim, id);
    sim.world.add(id, EatC, (eat = { x: spot.x, y: spot.y, galley: spot.galley, item, left: -1 }));
    path.steps = spot.steps;
  }
  if (!isSettled(pos) || path.steps.length > 0) return true; // still walking
  if (pos.x === eat.x && pos.y === eat.y) {
    if (!consumeAmmo(sim, pos.gridId, item)) {
      sim.world.remove(id, EatC);
      return false;
    }
    eat.item = item;
    eat.left = Math.round(EAT_SEC * TICK_HZ);
    clearPath(sim, id);
    crew.activity = 'eating';
    return true;
  }
  const steps = findPath(sim, pos.gridId, origin(pos), { x: eat.x, y: eat.y });
  if (!steps || steps.length === 0) {
    sim.world.remove(id, EatC);
    return false;
  }
  path.steps = steps;
  return true;
}
