import { evaPairs, evaPortals, floatCost, pairKey } from '../eva/links';
import type { Sim } from '../sim';
import { EVA_LINK_INTERVAL } from '../tuning';

/**
 * Open-space links. Every few ticks, each pair of airlocks on different grids whose collars lie within the suit's
 * float range gets an 'eva' portal (suit required, cost and time from the distance); links whose airlocks drifted out
 * of range or were removed are dropped. Changes go in as commands (applied next tick), the one way into the sim.
 * Whether a crew member may use a link is the planner's business: it needs a suit (SuitC) and working airlock ends.
 */
export function evaLinksSystem(sim: Sim): void {
  if (sim.tick % EVA_LINK_INTERVAL !== 0) return;
  const have = evaPortals(sim);
  const want = new Set<string>();
  for (const { a, b, dist } of evaPairs(sim)) {
    const key = pairKey(a.airlock, b.airlock);
    want.add(key);
    if (have.has(key)) continue;
    const { cost, ticks } = floatCost(sim, dist);
    sim.enqueue({
      type: 'portal.link', kind: 'eva', a: { gridId: a.gridId, ...a.tile }, b: { gridId: b.gridId, ...b.tile },
      cost, ticks, requires: [{ type: 'suit' }],
    });
  }
  for (const [key, id] of have) if (!want.has(key)) sim.enqueue({ type: 'portal.unlink', id });
}
