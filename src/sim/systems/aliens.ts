import { AlienC, type Alien } from '../aliens/components';
import { PathC, PositionC, type Path, type Position } from '../crew/components';
import { clearPath, isSettled, origin } from '../crew/helpers';
import { findPath } from '../crew/pathfind';
import { FighterC } from '../fight/components';
import { isCombatReady } from '../fight/relations';
import { isTileWalkable } from '../modules/walk';
import { shipGrid, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { ALIEN_ROAM, ALIEN_WANDER_CHANCE } from '../tuning';

/**
 * Aliens out of a fight, after crew combat (which runs their hunting, attacks and fleeing like any crew member's): an
 * idle alien now and then strolls to a random deck tile within ALIEN_ROAM of where it hatched. Leash: an alien is held to
 * its home ship. Paths are planned on that ship's grid only, so it cannot walk off; if it is ever found elsewhere it stops.
 */
export function alienSystem(sim: Sim): void {
  for (const id of sim.world.query(AlienC, PositionC, PathC)) {
    if (!isCombatReady(sim, id)) continue;
    const a = sim.world.get(id, AlienC) as Alien;
    const pos = sim.world.get(id, PositionC) as Position;
    if (shipIdOf(sim, pos) !== a.ship) {
      clearPath(sim, id);
      continue;
    }
    const f = sim.world.get(id, FighterC);
    if (f && f.mode !== 'idle') continue;
    const path = sim.world.get(id, PathC) as Path;
    if (path.steps.length > 0 || !isSettled(pos) || !sim.rng.chance(ALIEN_WANDER_CHANCE)) continue;
    const grid = shipGrid(sim, a.ship);
    const x = a.homeX + sim.rng.int(-ALIEN_ROAM, ALIEN_ROAM);
    const y = a.homeY + sim.rng.int(-ALIEN_ROAM, ALIEN_ROAM);
    if (!grid || !isTileWalkable(sim, grid, x, y)) continue;
    const steps = findPath(sim, a.ship, origin(pos), { x, y });
    if (steps && steps.length <= ALIEN_ROAM * 3) path.steps = steps;
  }
}
