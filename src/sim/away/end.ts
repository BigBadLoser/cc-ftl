import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from './components';
import { releaseOwned } from './owned';
import { dropPassages, letOut } from './passage';

/**
 * End a site's run: its passages are withdrawn, the shuttle no longer flies itself, and the site closes with it. The
 * party leaves it with the run (crew still on the site are ordinary crew there): their `AwayC` and its holds end in away/owned.ts.
 */
export function endRun(sim: Sim, id: number, r: SiteRun, reason: 'closed' | 'lost'): void {
  dropPassages(sim, id);
  const v = sim.world.get(id, VehicleC);
  if (v) v.autopilot = false;
  sim.world.remove(id, SiteRunC);
  if (sim.world.get(r.site, AwaySiteC)?.vehicle === id) sim.world.remove(r.site, AwaySiteC);
  if (!r.pickup) sim.events.emit({ type: 'away.closed', ship: r.site, vehicle: id, reason });
}

/**
 * Before a cut (a ship lifted out of the sector, or the sector archived on a jump): every run whose shuttle, site and the shuttle's home ship
 * would not all stay on the same side ends here, while both sides are still in the world, so no `AwayC`, `SiteRunC` or `AwaySiteC` refers
 * across the cut. `side` tells the side of an entity (an id not in the world is on the far side). Passengers in a shuttle at home step out
 * at its boarding tile; the party on the site stays there as ordinary (stranded) crew.
 */
export function endSplitRuns(sim: Sim, side: (id: number) => boolean): void {
  for (const id of [...sim.world.query(SiteRunC)].sort((a, b) => a - b)) {
    const r = sim.world.get(id, SiteRunC) as SiteRun;
    const v = sim.world.get(id, VehicleC);
    const here = side(id);
    if (v && side(r.site) === here && side(v.homeShip) === here) continue;
    if (v && (v.state === 'stowed' || v.state === 'docked')) letOut(sim, id, (c) => sim.world.has(c, AwayC));
    endRun(sim, id, r, 'lost');
  }
  releaseOwned(sim); // what the ended runs owned goes now, before either side is archived (nothing runs the sweep there)
}
