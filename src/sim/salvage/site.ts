import { AwaySiteC } from '../away/components';
import { openSite } from '../away/handlers';
import { unstagedOn } from '../away/haul';
import { JobC } from '../crew/components';
import type { Sim } from '../sim';
import { SalvageOrderC, type SalvageBlock, type SalvageOrder } from './components';
import { salvageJobs } from './plan';

/**
 * Salvage on an away site (docs/ARCHITECTURE.md "Derelict salvage", #286 slice 3). A running order keeps an away site open on its wreck: the
 * site's shuttle carries the crew there on passages, refills them, hauls the loot home and brings them back (away/). Salvage only says what
 * to cut (the stripping jobs), how much work is waiting (`demand`), and when the site should close.
 */

/** Set a block on the order (the hostile block, owned by the salvage system, wins). */
function block(sim: Sim, ship: number, o: SalvageOrder, reason: SalvageBlock): void {
  if (o.block === 'hostile' || o.block === reason) return;
  o.status = 'blocked';
  o.block = reason;
  sim.events.emit({ type: 'salvage.blocked', ship, reason });
}

/** Lift a site block (`noShuttle`, `noCrew`) from the order. */
function unblock(sim: Sim, ship: number, o: SalvageOrder): void {
  if (o.block !== 'noShuttle' && o.block !== 'noCrew') return;
  o.status = 'running';
  delete o.block;
  sim.events.emit({ type: 'salvage.ordered', ship, types: [...o.types] });
}

/**
 * The work waiting on the wreck, for the site's seats (docs/DESIGN.md "Salvage on top"): stripping is construction (its open jobs), carrying
 * is hauling (the loose stacks outside the staging zone, each a haul into it). While nothing lies loose yet but stripping jobs are open,
 * the loot they will drop counts as one haul, so the first trip already has a hauling seat.
 */
export function salvageDemand(sim: Sim, ship: number): { construction: number; hauling: number } {
  const jobs = salvageJobs(sim, ship).filter((j) => sim.world.get(j, JobC)!.reservedBy === 0).length;
  const loose = unstagedOn(sim, ship).length;
  return { construction: jobs, hauling: loose > 0 ? loose : jobs > 0 ? 1 : 0 };
}

/**
 * Keep the order's site in step with it: open one while the order runs and none is open (`noShuttle` while no shuttle is free to serve
 * it), show the site's own hold-up (`noCrew`: passages left untaken), and write its demand. `wanted` false (blocked by a hostile, or
 * finished) closes it; the party then comes home and the run ends.
 */
export function tendSite(sim: Sim, ship: number, o: SalvageOrder, wanted: boolean): void {
  const site = sim.world.get(ship, AwaySiteC);
  if (!wanted) {
    if (site?.status === 'open') site.status = 'closing';
    return;
  }
  if (!site) {
    if (openSite(sim, ship, 'salvage') === 'noShuttle') return block(sim, ship, o, 'noShuttle');
    return unblock(sim, ship, o);
  }
  if (site.status !== 'open') return; // closing (recalled): a new one opens once it is gone
  site.demand = salvageDemand(sim, ship);
  if (site.block === 'noCrew') block(sim, ship, o, 'noCrew');
  else unblock(sim, ship, o);
}

/** Close every salvage site whose order is gone (cancelled or finished): the order is the site's owner. */
export function closeOrphanSites(sim: Sim): void {
  for (const ship of sim.world.query(AwaySiteC)) {
    const s = sim.world.get(ship, AwaySiteC)!;
    if (s.owner === 'salvage' && s.status === 'open' && !sim.world.has(ship, SalvageOrderC)) s.status = 'closing';
  }
}
