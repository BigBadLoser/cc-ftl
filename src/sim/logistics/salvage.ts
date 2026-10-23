import { ShipC } from '../combat/components';
import { homeShip } from '../combat/ships';
import { CrewC, DeadC, JobC, PositionC } from '../crew/components';
import { AllegianceC } from '../fight/components';
import { isFerryRegion, isPickupRegion, regionStock } from '../ferry/pick';
import { shipIdAt, shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { VehicleC } from '../vehicles/components';
import { SalvageWatchC, TransferC } from './components';
import { queueTransfer } from './handlers';

/** How often salvage sites are looked at (ticks), and how long a site must sit still (seconds) to count as finished. */
const LOOK_EVERY = 30;
const QUIET_SEC = 20;
/** Hold size assumed when the player has no shuttle yet. */
const DEFAULT_LOAD = 40;

/** True while someone of the player's side stands on the site: salvage is crew work, so an empty wreck is left alone. */
function crewOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(CrewC, PositionC)) {
    if (!sim.world.has(id, DeadC) && sim.world.get(id, AllegianceC)?.faction === 'player' && shipIdOf(sim, sim.world.get(id, PositionC)) === ship) return true;
  }
  return false;
}

/** True while a job (a haul, a deconstruction) is still open on the site's tiles. */
function jobsOn(sim: Sim, ship: number): boolean {
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j && shipIdAt(sim, j.x, j.y) === ship) return true;
  }
  return false;
}

/** The biggest hold among the player's shuttles: a load that fills one is worth a trip by itself. */
function shuttleLoad(sim: Sim): number {
  let best = 0;
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC);
    const def = v && vehicleDefOf(sim, v);
    if (def && def.class !== 'pod') best = Math.max(best, def.cargo ?? 0);
  }
  return best || DEFAULT_LOAD;
}

/**
 * Auto-ferry for salvage. On a prize or a ruined derelict where the player's crew work, whatever loot (storage and loose stacks)
 * has piled up is queued as one transfer to the home ship: when it fills a shuttle, or when the salvage has gone quiet (no open
 * jobs there and the pile has not changed for a while). One open salvage order per site; later loot makes a new one.
 */
export function salvageWatch(sim: Sim): void {
  if (sim.tick % LOOK_EVERY !== 0) return;
  const home = homeShip(sim);
  if (!home || !isFerryRegion(sim, home)) return;
  const open = new Set<number>();
  for (const id of sim.world.query(TransferC)) {
    const t = sim.world.get(id, TransferC);
    if (t?.auto === 'salvage') open.add(t.from);
  }
  for (const site of [...sim.world.query(ShipC)].sort((a, b) => a - b)) {
    if (site === home || isFerryRegion(sim, site) || !isPickupRegion(sim, site) || open.has(site) || !crewOn(sim, site)) continue;
    const stock = regionStock(sim, site);
    const units = stock.reduce((n, l) => n + l.count, 0);
    if (units === 0) {
      sim.world.remove(site, SalvageWatchC);
      continue;
    }
    let w = sim.world.get(site, SalvageWatchC);
    if (!w) sim.world.add(site, SalvageWatchC, (w = { units, since: sim.tick }));
    if (w.units !== units) Object.assign(w, { units, since: sim.tick });
    const quiet = sim.tick - w.since >= QUIET_SEC * TICK_HZ && !jobsOn(sim, site);
    if (units < shuttleLoad(sim) && !quiet) continue;
    if (typeof queueTransfer(sim, site, home, stock, 'salvage') === 'number') sim.world.remove(site, SalvageWatchC);
  }
}
