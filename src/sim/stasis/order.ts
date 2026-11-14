import { CrewC, JobC, PositionC } from '../crew/components';
import { origin } from '../crew/helpers';
import { PrisonerC } from '../fight/components';
import { CarryingC } from '../items/components';
import { destroyJob, dropCarried } from '../items/stacks';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { playerShips } from '../story/world';
import { StasisC } from './components';
import { pickWheel } from './jobs';
import { SLAB_ITEM } from './tuning';

/**
 * The player's seal order (#116): crew seal a prisoner into stasis only after the player marks them (`Prisoner.seal`, command 'prisoner.seal').
 * The order sits on the prisoner, so it is saved with them and ends with the prisoner (thawed, released, dead).
 */

/** Why a prisoner cannot be marked for sealing: 'notPrisoner', 'frozen' (already sealed), 'notYours' (not on one of the player's ships) or 'noWheel' (no stasis wheel on their ship that can take a slab and that a walk from them reaches). Null when they can. */
export function sealRefusal(sim: Sim, crew: number): string | null {
  const pos = sim.world.get(crew, PositionC);
  if (sim.world.has(crew, StasisC)) return 'frozen';
  if (!sim.world.has(crew, PrisonerC) || !pos) return 'notPrisoner';
  const ship = shipIdOf(sim, pos);
  if (!playerShips(sim).has(ship)) return 'notYours';
  return pickWheel(sim, ship, origin(pos)) ? null : 'noWheel';
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
