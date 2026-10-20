import { gridIdOf } from '../regions';
import { CrewC, DeadC, PathC, PositionC, type Path, type Position } from '../crew/components';
import { isIncapacitated, isSettled } from '../crew/helpers';
import { isTileWalkable } from '../modules/walk';
import { AirlockC, CrossingC, PortalC, type Portal, type PortalEnd } from '../portals/components';
import { portalUsable } from '../portals/graph';
import { requestAirlock } from '../portals/airlock';
import type { Sim } from '../sim';

/**
 * Crossing between grids. A crew member who has walked to the end of a leg with a portal planned next stops at the
 * portal's source tile and starts a traversal, once the portal is usable and its airlock ends have cycled to the
 * outer door (they are asked to). The traversal takes `portal.ticks`; when it ends the crew member's Position moves to
 * the far end, on the far grid, and the next leg's steps load. A portal that vanished, broke or became unusable drops
 * the rest of the journey and leaves the crew member where they stand.
 */
export function portalSystem(sim: Sim): void {
  for (const id of sim.world.query(CrewC, PositionC, PathC)) {
    if (sim.world.has(id, DeadC) || isIncapacitated(sim, id)) {
      sim.world.remove(id, CrossingC);
      continue;
    }
    const pos = sim.world.get(id, PositionC) as Position;
    const path = sim.world.get(id, PathC) as Path;
    const crossing = sim.world.get(id, CrossingC);

    if (crossing) {
      const portal = sim.world.get(crossing.portal, PortalC);
      if (!portal || !portalUsable(sim, portal, id)) {
        sim.world.remove(id, CrossingC);
        delete path.then;
        continue;
      }
      if (--crossing.ticks > 0) continue;
      sim.world.remove(id, CrossingC);
      finish(sim, id, pos, path, portal, crossing.portal, crossing.from);
      continue;
    }

    const leg = path.then?.[0];
    if (!leg || path.steps.length > 0 || !isSettled(pos)) continue;
    const portal = sim.world.get(leg.portal, PortalC);
    const from = portal && endAt(sim, portal, pos);
    if (!portal || !from || !portalUsable(sim, portal, id)) {
      delete path.then;
      continue;
    }
    if (!airlocksReady(sim, portal)) continue;
    if (portal.ticks <= 0) finish(sim, id, pos, path, portal, leg.portal, from);
    else sim.world.add(id, CrossingC, { portal: leg.portal, from, ticks: portal.ticks });
  }
}

/** Which end of the portal the crew member stands on, if they may enter from it. */
function endAt(sim: Sim, portal: Portal, pos: Position): 'a' | 'b' | null {
  const at = (e: PortalEnd): boolean => e.gridId === gridIdOf(sim, pos) && e.x === pos.x && e.y === pos.y;
  if (at(portal.a)) return 'a';
  if (!portal.oneWay && at(portal.b)) return 'b';
  return null;
}

/** True if every airlock end of the portal has its outer door open; otherwise asks the closed ones to cycle. */
function airlocksReady(sim: Sim, portal: Portal): boolean {
  let ready = true;
  for (const e of [portal.a, portal.b]) {
    const a = e.airlock === undefined ? undefined : sim.world.get(e.airlock, AirlockC);
    if (a && a.state !== 'outer') {
      requestAirlock(sim, e.airlock as number, 'outer');
      ready = false;
    }
  }
  return ready;
}

function finish(sim: Sim, id: number, pos: Position, path: Path, portal: Portal, portalId: number, from: 'a' | 'b'): void {
  const dest = from === 'a' ? portal.b : portal.a;
  const leg = (path.then ?? []).shift();
  const grid = sim.grids.get(dest.gridId);
  if (!leg || leg.portal !== portalId || !grid || !isTileWalkable(sim, grid, dest.x, dest.y)) {
    delete path.then;
    return;
  }
  const source = from === 'a' ? portal.a : portal.b;
  pos.x = pos.toX = dest.x;
  pos.y = pos.toY = dest.y;
  pos.progress = 0;
  path.steps = leg.steps;
  if (path.then?.length === 0) delete path.then;
  sim.events.emit({
    type: 'crew.crossed', crew: id, portal: portalId, kind: portal.kind,
    fromGridId: source.gridId, toGridId: dest.gridId, x: dest.x, y: dest.y,
  });
}
