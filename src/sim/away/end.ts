import { destroyJob } from '../items/stacks';
import { haulsTo } from '../salvage/cargoRun';
import type { Sim } from '../sim';
import { VehicleC } from '../vehicles/components';
import { AwayC, AwaySiteC, SiteRunC, type SiteRun } from './components';
import { dropPassages, letOut } from './passage';

/**
 * End a site's run: its passages and hauls to the hold are withdrawn, the shuttle no longer flies itself, the party leaves it (crew still on
 * the site are ordinary crew there), and the site closes with it.
 */
export function endRun(sim: Sim, id: number, r: SiteRun, reason: 'closed' | 'lost'): void {
  dropPassages(sim, id);
  for (const j of haulsTo(sim, id)) destroyJob(sim, j);
  const v = sim.world.get(id, VehicleC);
  if (v) v.autopilot = false;
  for (const c of [...sim.world.query(AwayC)].sort((a, b) => a - b)) if (sim.world.get(c, AwayC)?.vehicle === id) sim.world.remove(c, AwayC);
  sim.world.remove(id, SiteRunC);
  if (sim.world.get(r.site, AwaySiteC)?.vehicle === id) sim.world.remove(r.site, AwaySiteC);
  sim.events.emit({ type: 'away.closed', ship: r.site, vehicle: id, reason });
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
}
