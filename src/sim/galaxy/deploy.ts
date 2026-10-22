import { ShipC } from '../combat/components';
import { isAiFaction } from '../combat/factions';
import { drawEvent } from '../story/engine';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { spawnContact } from './arrivals';
import { nodeState } from './state';
import { ARRIVAL_EVERY_SEC } from './tuning';

/** Any AI ship still in play in the sector (restored from an archive or just materialised). */
function enemiesPresent(sim: Sim): boolean {
  return sim.world.query(ShipC).some((id) => {
    const s = sim.world.get(id, ShipC);
    return !!s && isAiFaction(s.faction) && s.state === 'active';
  });
}

/**
 * The player's ship has been placed (`sector.deploy`) in the node `sim.galaxy.current`:
 * - the first time the player enters the node, its generated contacts materialise as real ships (placed around the ship by the
 *   deploy bounds and the gap rule); from then on the node's archive owns them and the descriptors are gone. A contact that finds
 *   no room stays a descriptor and is tried again on the next arrival roll's pruning-free pass (never: it is simply lost);
 * - the arrival clock restarts;
 * - the story draw owed since the jump runs (a 'transit' one after an anchored hyperlane), unless enemies are waiting.
 * Re-entering a visited node restores its archive and spawns nothing new.
 */
export function onDeployed(sim: Sim): void {
  const g = sim.galaxy;
  const st = nodeState(sim, g.current);
  if (!st.entered) {
    st.entered = true;
    for (const c of st.contacts) spawnContact(sim, g.current, c);
    st.contacts = st.contacts.filter((c) => c.ship !== undefined);
  }
  g.nextArrival = sim.tick + Math.round(ARRIVAL_EVERY_SEC * TICK_HZ);
  const draw = g.pendingDraw;
  g.pendingDraw = null;
  if (draw && !enemiesPresent(sim)) drawEvent(sim, draw);
  g.rev++;
}
