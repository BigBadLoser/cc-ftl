import { ShipC } from '../combat/components';
import { isAiFaction } from '../combat/factions';
import { drawEvent } from '../story/engine';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { ARRIVAL_EVERY_SEC } from './tuning';
import { resetTurnClock } from './turn';

/** Any AI ship still in play in the sector (restored from an archive or just materialised). */
function enemiesPresent(sim: Sim): boolean {
  return sim.world.query(ShipC).some((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && isAiFaction(s.faction) && s.state === 'active';
  });
}

/**
 * The player's ship has been placed (`sector.deploy`) in the node `sim.galaxy.current`: the arrival clock restarts and the story
 * draw owed since the trip runs (a 'transit' one after an anchored hyperlane), unless enemies are waiting. (The node's ships were
 * restored or materialised when the ship dropped out of hyperspace, so the deploy picker could see them.)
 */
export function onDeployed(sim: Sim): void {
  const g = sim.galaxy;
  // An event grid is not a node: no arrival clock, no story draw.
  if (g.event) return void g.rev++;
  resetTurnClock(sim);
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  const draw = g.pendingDraw;
  g.pendingDraw = null;
  if (draw && !enemiesPresent(sim)) drawEvent(sim, draw);
  g.rev++;
}
