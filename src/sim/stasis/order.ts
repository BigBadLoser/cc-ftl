import { CrewC, JobC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { PrisonerC } from '../fight/components';
import { CarryingC } from '../items/components';
import { destroyJob, dropCarried } from '../items/stacks';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips } from '../story/world';
import { StasisC } from './components';
import { pickWheel, slabSources, stasisRoom } from './jobs';
import { rackHere } from './rack';
import { AwaySiteC } from '../away/components';
import { ShipC } from '../combat/components';
import { isFerryRegion } from '../ferry/pick';
import { VehicleC } from '../vehicles/components';
import { vehicleDefOf } from '../vehicles/lifecycle';
import { SLAB_ITEM } from './tuning';

/**
 * The player's seal order (#116): crew seal a prisoner into stasis only after the player marks them (`Prisoner.seal`, command 'prisoner.seal').
 * The order sits on the prisoner, so it is saved with them and ends with the prisoner (thawed, released, dead).
 */

/**
 * Why a prisoner cannot be marked for sealing: 'notPrisoner', 'frozen' (already sealed), 'notYours' (not on one of the player's ships), 'noWheel'
 * (nowhere to hold them: on their ship no stasis wheel that can take a slab and that a walk from them reaches, and, on a prize, no wheel with room
 * on a ship of the player's with a shuttle to carry the slab there) or 'noShuttle' (a prize, and the player has no shuttle at all to carry it).
 * Null when they can. Only these impossibilities refuse a mark: a prize without a shuttle there yet is the crew's to see to (stasis/shuttle.ts),
 * shown by `sealWait`.
 */
export function sealRefusal(sim: Sim, crew: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (sim.world.has(crew, StasisC)) return 'frozen';
  if (!sim.world.has(crew, PrisonerC) || !pos) return 'notPrisoner';
  const ship = shipIdOf(sim, pos);
  if (!playerShips(sim).has(ship)) return 'notYours';
  if (pickWheel(sim, ship, origin(pos))) return null;
  if (sim.world.get(ship, ShipC)?.state !== 'prize') return 'noWheel';
  const homes = new Set<number>();
  for (const id of sim.world.query(VehicleC)) {
    const v = sim.world.get(id, VehicleC)!;
    if (v.homeShip !== ship && isFerryRegion(sim, v.homeShip) && vehicleDefOf(sim, v)?.eva) homes.add(v.homeShip);
  }
  if (homes.size === 0) return 'noShuttle';
  return [...homes].some((h) => stasisRoom(sim, h) > 0) ? null : 'noWheel';
}

/**
 * What a marked prisoner waits on while no crew member is on their seal yet, or null (a stasis job is posted for them, or they are not marked):
 * 'noShuttle' (a prize, no shuttle free to fly out), 'noCrew' (its shuttle waits for crew to take the hauling seats), 'shuttle' (the shuttle is on
 * its way with empty slabs, or on a trip), 'noSlab' (no empty slab on their ship), 'noRoom' (every wheel that could take them is spoken for).
 */
export function sealWait(sim: Sim, crew: number): 'noShuttle' | 'noCrew' | 'shuttle' | 'noSlab' | 'noRoom' | null {
  const pos = sim.world.get(crew, PositionC);
  if (!sealMarked(sim, crew) || !pos || hasStasisJob(sim, crew)) return null;
  const ship = shipIdOf(sim, pos);
  if (!pickWheel(sim, ship, origin(pos)) && sim.world.get(ship, ShipC)?.state === 'prize') {
    const site = sim.world.get(ship, AwaySiteC);
    if (!site) return 'noShuttle';
    if (site.block === 'noCrew') return 'noCrew';
    if (!rackHere(sim, ship)) return 'shuttle';
  }
  if (stasisRoom(sim, ship) <= 0) return 'noRoom';
  return slabSources(sim, ship).length === 0 ? (rackHere(sim, ship) ? 'shuttle' : 'noSlab') : null;
}

/** True if a stasis job (any phase) is posted for the prisoner: the crew are on it. */
function hasStasisJob(sim: Sim, prisoner: number): boolean {
  return sim.world.query(JobC).some((j) => {
    const job = sim.world.get(j, JobC);
    return job?.kind === 'stasis' && job.target === prisoner;
  });
}

/** True if the player has marked this prisoner for sealing. */
export const sealMarked = (sim: Sim, crew: number): boolean => !!sim.world.get(crew, PrisonerC)?.seal;

/**
 * Set a prisoner's seal order: a reject reason, or null. Marking is refused by `sealRefusal`; calling it off is always allowed and scraps their
 * seal job still on the way (`scrapSealJob`).
 */
export function setSealOrder(sim: Sim, crew: number, on: boolean): string | null {
  const p = sim.world.get(crew, PrisonerC);
  if (!p) return sim.world.has(crew, StasisC) ? 'frozen' : 'notPrisoner';
  if (!on) {
    delete p.seal;
    for (const id of [...sim.world.query(JobC)].sort((a, b) => a - b)) {
      const j = sim.world.get(id, JobC);
      if (j?.kind === 'stasis' && j.target === crew && (j.stasis?.phase === 'fetch' || j.stasis?.phase === 'seal')) scrapSealJob(sim, id);
    }
    return null;
  }
  const err = sealRefusal(sim, crew);
  if (err) return err;
  p.seal = true;
  return null;
}

/**
 * Remove a stasis job. In the fetch or seal phase (nothing sealed yet) the empty slab its crew member fetched is set down where they stand: it stays
 * in the ship's stock, lying on the floor, so no slab is lost. (A job further on carries a full slab, which the stasis system sets down itself.)
 */
export function scrapSealJob(sim: Sim, jobId: number): void {
  const job = sim.world.get(jobId, JobC);
  if (!job) return;
  const phase = job.stasis?.phase;
  const crew = job.reservedBy;
  if ((phase === 'fetch' || phase === 'seal') && crew && sim.world.has(crew, CrewC) && sim.world.get(crew, CarryingC)?.item === SLAB_ITEM) dropCarried(sim, crew);
  destroyJob(sim, jobId);
}
