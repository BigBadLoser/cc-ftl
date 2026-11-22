import { tendTraffic } from '../galaxy/traffic';
import type { Sim } from '../sim';

/**
 * NPC ships go about their business in the player's node (#603, galaxy/traffic.ts): station shuttles call at visiting traders, miners' pods work
 * the field, patrols inspect NPC ships. Only in the real node, live, never in an event grid.
 */
export function npcTrafficSystem(sim: Sim): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event || sim.sector.node !== g.current) return;
  tendTraffic(sim);
}
