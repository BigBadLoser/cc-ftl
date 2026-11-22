import { callAid } from '../galaxy/engagementAid';
import { tendEngagements } from '../galaxy/engagementFlow';
import { tendTraffic } from '../galaxy/traffic';
import type { Sim } from '../sim';

/**
 * Fights between NPC ships in the player's node (#603): fleets at war that met here fight as real ships, allies take on whoever fires on the player,
 * and each fight ends with its consequences (galaxy/engagementFlow.ts, galaxy/engagementAid.ts); between fights they go about their business
 * (galaxy/traffic.ts). Only in the real node, live, never in an event grid.
 */
export function engagementSystem(sim: Sim): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event || sim.sector.node !== g.current) return;
  callAid(sim);
  tendEngagements(sim);
  tendTraffic(sim);
}
