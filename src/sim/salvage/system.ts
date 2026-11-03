import { destroyJob } from '../items/stacks';
import { FerryC } from '../ferry/components';
import { TransferC } from '../logistics/components';
import type { Sim } from '../sim';
import { SALVAGE_EVERY } from '../tuning';
import { SalvageOrderC } from './components';
import { hostilesAboard } from './counts';
import { planJobs, salvageJobs } from './plan';
import { isEmptyShell, removeWreck } from './remove';
import { AwaySiteC } from '../away/components';
import { looseOn } from '../away/haul';
import { closeOrphanSites, tendSite } from './site';

/** True while something hostile to the player is aboard: a living, non-surrendered hostile crew member, an egg sac or a nest. */
export function hostileAboard(sim: Sim, ship: number): boolean {
  const h = hostilesAboard(sim, ship);
  return h.crew + h.sacs + h.nests > 0;
}

/** True while a shuttle run (a logistics transfer, or a hand-made ferry run) is still moving loot or crew off the wreck: the wreck stays until it has landed. */
function ferryingFrom(sim: Sim, ship: number): boolean {
  if (sim.world.query(FerryC).some((id) => sim.world.get(id, FerryC)?.from === ship)) return true;
  return sim.world.query(TransferC).some((id) => {
    const t = sim.world.get(id, TransferC);
    return t?.from === ship && (t.status === 'boarding' || t.status === 'underway');
  });
}

/**
 * Derelict salvage. For each wreck with a salvage order, every SALVAGE_EVERY ticks: blocks the order (and drops its open jobs) while
 * anything hostile is aboard, runs it again once cleared, keeps a capped number of stripping jobs open, keeps an away site open on the wreck
 * while there is work (salvage/site.ts: the site's shuttle brings the crew and takes the loot home), and finishes the order when nothing of
 * the ticked types is left and the open site has carried off the loot (unless it cannot take it home: no room, stranded), removing the
 * wreck if nothing at all is, once the site has closed. The crew do the stripping as ordinary jobs. After haulCleanup (so the stacks it looks at are current)
 * and before the planners and the scheduler that hand the jobs out.
 */
export function salvageSystem(sim: Sim): void {
  if (sim.tick % SALVAGE_EVERY !== 0) return;
  closeOrphanSites(sim);
  for (const ship of [...sim.world.query(SalvageOrderC)].sort((a, b) => a - b)) {
    const order = sim.world.get(ship, SalvageOrderC);
    if (!order) continue;
    if (hostileAboard(sim, ship)) {
      for (const job of salvageJobs(sim, ship)) destroyJob(sim, job);
      if (order.status !== 'blocked' || order.block !== 'hostile') {
        order.status = 'blocked';
        order.block = 'hostile';
        sim.events.emit({ type: 'salvage.blocked', ship, reason: 'hostile' });
      }
      tendSite(sim, ship, order, false);
      continue;
    }
    if (order.status === 'blocked' && order.block === 'hostile') {
      order.status = 'running';
      delete order.block;
      sim.events.emit({ type: 'salvage.ordered', ship, types: [...order.types] });
    }
    const site = sim.world.get(ship, AwaySiteC);
    // Loot still lying about is carried off before the site closes, while its shuttle can take it home (not `noRoom` or `stranded`).
    const loot = site?.status === 'open' && !site.block && looseOn(sim, ship).length > 0;
    const work = planJobs(sim, ship, order.types) > 0 || salvageJobs(sim, ship).length > 0;
    tendSite(sim, ship, order, work || loot);
    if (work || loot || ferryingFrom(sim, ship)) continue;
    // Finished, but the party is still out there: the wreck stays until the site has closed (its run ends once everyone is home).
    if (site) continue;
    const removed = isEmptyShell(sim, ship);
    sim.events.emit({ type: 'salvage.done', ship, removed });
    if (removed) removeWreck(sim, ship);
    else sim.world.remove(ship, SalvageOrderC);
  }
}
