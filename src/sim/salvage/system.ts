import { destroyJob } from '../items/stacks';
import { FerryC } from '../ferry/components';
import { TransferC } from '../logistics/components';
import type { Sim } from '../sim';
import { SALVAGE_EVERY } from '../tuning';
import { SalvageOrderC } from './components';
import { hostilesAboard } from './counts';
import { planJobs, salvageJobs } from './plan';
import { isEmptyShell, removeWreck } from './remove';
import { teamAt } from './team';

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
 * anything hostile is aboard, runs it again once cleared, keeps a capped number of stripping jobs open, and finishes it when nothing of
 * the ticked types is left (and the salvage team is clear of it), removing the wreck if nothing at all is. The crew do the stripping as
 * ordinary jobs; the salvage team's shuttle (trip.ts) brings them. Only the 'hostile' block is set and lifted here; the trip system owns the
 * others ('noShuttle', 'noCrew'). After haulCleanup (so the stacks it looks at are current) and before the planners and the scheduler
 * that hand the jobs out.
 */
export function salvageSystem(sim: Sim): void {
  if (sim.tick % SALVAGE_EVERY !== 0) return;
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
      continue;
    }
    if (order.status === 'blocked' && order.block === 'hostile') {
      order.status = 'running';
      delete order.block;
      sim.events.emit({ type: 'salvage.ordered', ship, types: [...order.types] });
    }
    if (planJobs(sim, ship, order.types) > 0 || salvageJobs(sim, ship).length > 0 || ferryingFrom(sim, ship)) continue;
    // Finished, but the salvage team is still out there: it stays until they are back aboard their shuttle.
    if (teamAt(sim, ship)) continue;
    const removed = isEmptyShell(sim, ship);
    sim.events.emit({ type: 'salvage.done', ship, removed });
    if (removed) removeWreck(sim, ship);
    else sim.world.remove(ship, SalvageOrderC);
  }
}
