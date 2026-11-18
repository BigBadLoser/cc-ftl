import type { Sim } from '../sim';

/** Help for a rescue event, apart from galaxy/eventGrid.ts so that settling a deal (trade/deals.ts) does not import the event grid (#553). */

/** A deal with `ship` settled: in a rescue grid that is the help the damaged fleet was waiting for (`EventGrid.helped`). */
export function noteHelp(sim: Sim, ship: number): void {
  const ev = sim.galaxy.event;
  if (ev?.kind === 'rescue' && ev.fleet?.ships.some((c) => c.ship === ship)) ev.helped = true;
}
