import type { Job } from '../crew/components';
import { AssignmentC, CrewC, DraftedC, JobC, PositionC, PrioritiesC } from '../crew/components';
import { isIncapacitated, releaseAssignment } from '../crew/helpers';
import { isOffDuty } from '../fight/relations';
import { CombatC, IonC } from '../combat/components';

import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import type { Sim } from '../sim';
import { shipIdOf } from '../regions';
import { shipById } from '../combat/ships';
import { freeOperatorFor, jobTakeable } from '../crew/jobFit';
import { consoleSkill, skillOf } from '../combat/operators';
import { chargeOrdered, seatHelms } from '../ftl/order';
import { OPERATE_MAX_LEVEL } from '../tuning';

/**
 * Opens one 'operate' job (category operating) per console while it is needed and drops it when it is not.
 * A console is needed during combat while its ship is active, the console is powered and intact; outside combat the helm is needed while
 * a charge order stands (`ftl.charge`), and `seatHelms` sends the best free pilot (else any crew) to it.
 * Crew who hold the job stand on the access tile ("manning" the console, see combat/operators).
 * Seam: automation (AI core tiers) would stand in for missing operators here, at reduced efficiency.
 */
export function operateJobsSystem(sim: Sim): void {
  const open = new Map<number, number>(); // console module -> job id
  for (const jobId of [...sim.world.query(JobC)]) {
    const job = sim.world.get(jobId, JobC);
    if (job?.kind !== 'operate') continue;
    // A console a drafted crew member was ordered to man stays open until they are released, fight or no fight.
    const ordered = !!job.reservedBy && sim.world.has(job.reservedBy, DraftedC) && stationUsable(sim, job.target ?? 0);
    if ((ordered || consoleNeeded(sim, job.target ?? 0)) && !open.has(job.target ?? 0)) {
      open.set(job.target ?? 0, jobId);
      if (job.reservedBy) {
        // a relief's hold leaves `freeSince` as it was, so a relief that yields (and nobody takes the console) is not made to wait again
        if (!isRelief(sim, job.reservedBy)) delete job.freeSince;
        else yieldToOperator(sim, job.reservedBy);
      }
      else {
        job.freeSince ??= sim.tick;
        callOperator(sim, job);
      }
      continue;
    }
    if (job.reservedBy) releaseAssignment(sim, job.reservedBy);
    sim.world.destroyEntity(jobId);
  }
  // Nothing to open outside combat unless a charge order stands.
  if (!sim.sector.inCombat && !sim.world.query(CombatC).some((id) => sim.world.get(id, CombatC)?.ftlOrder)) return;
  const fresh = new Set<number>();
  for (const id of sim.world.query(ModuleC)) {
    if (open.has(id) || !consoleNeeded(sim, id)) continue;
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    const at = m && def && accessTile(def, m.x, m.y, m.rot);
    if (!m || !at) continue;
    const job = sim.world.createEntity();
    sim.world.add(job, JobC, {
      category: 'operating', kind: 'operate', x: at.x, y: at.y, struct: 0, work: 1, progress: 0,
      reservedBy: 0, target: id, freeSince: sim.tick,
    });
    fresh.add(job);
  }
  seatHelms(sim, fresh);
}

/** A console that exists, is intact and is on a ship still in play. */
function stationUsable(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  return !!m && !!sim.content.modules[m.def]?.console && m.hp > 0 && shipById(sim, shipIdOf(sim, m))?.state === 'active';
}

function consoleNeeded(sim: Sim, id: number): boolean {
  const m = sim.world.get(id, ModuleC);
  const console = m && sim.content.modules[m.def]?.console;
  if (!m || !console) return false;
  // Outside combat only an ordered drive charge (`ftl.charge`) needs a console: the helm.
  if (!sim.sector.inCombat && !(console === 'helm' && chargeOrdered(sim, shipIdOf(sim, m)))) return false;
  if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC)) return false;
  return shipById(sim, shipIdOf(sim, m))?.state === 'active';
}


/**
 * A relief (a crew member whose operating priority is low, standing in for an absent operator) hands the console back when other work they rank
 * higher is waiting, or when a crew member who operates by choice (priority 1 or 2) has nothing to do: the skilled hand is back from their break.
 */
function yieldToOperator(sim: Sim, holder: number): void {
  const prio = sim.world.get(holder, PrioritiesC);
  const pos = sim.world.get(holder, PositionC);
  if (!sim.sector.inCombat || !prio || !pos) return;
  const ship = shipIdOf(sim, pos);
  // work they rank above operating (a fire, a downed crew member, a repair) calls a relief off the console, if they can take it
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    const level = j ? prio[j.category] : 0;
    if (j && j.reservedBy === 0 && j.kind !== 'operate' && level >= 1 && level < prio.operating && jobTakeable(sim, holder, pos, j)) return void releaseAssignment(sim, holder);
  }
  // an operator by choice of this ship with nothing to do takes the console back
  const job = sim.world.get(sim.world.get(holder, AssignmentC)?.jobId ?? 0, JobC);
  if (job && freeOperatorFor(sim, ship, job)) releaseAssignment(sim, holder);
}

/** True for an undrafted crew member whose operating priority is below the operators' (a stand-in, not an operator by choice). */
function isRelief(sim: Sim, crew: number): boolean {
  if (sim.world.has(crew, DraftedC)) return false; // a drafted crew member was ordered to the console: no relief rule moves them
  return (sim.world.get(crew, PrioritiesC)?.operating ?? 0) > OPERATE_MAX_LEVEL;
}

/**
 * An empty console in a fight calls the crew member who operates by choice (operating priority 1 or 2, the best skill first) away from a
 * chore they rank lower, so a gunner busy with repairs goes back to the weapons console instead of leaving it empty. The release only frees
 * them: `decideSystem` then picks the best job, which is the console.
 */
function callOperator(sim: Sim, job: Job): void {
  if (!sim.sector.inCombat) return;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const kind = m && sim.content.modules[m.def]?.console;
  if (!kind) return;
  let best = 0;
  let bestSkill = -1;
  const ship = shipIdOf(sim, m);
  for (const id of sim.world.query(CrewC, PrioritiesC, AssignmentC, PositionC)) {
    const prio = sim.world.get(id, PrioritiesC);
    if (shipIdOf(sim, sim.world.get(id, PositionC)) !== ship) continue; // only this ship's crew
    const busy = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
    const level = prio?.operating ?? 0;
    if (!prio || !busy || busy.kind === 'operate' || level < 1 || level > OPERATE_MAX_LEVEL) continue;
    const at = sim.world.get(id, PositionC);
    if (!at || !jobTakeable(sim, id, at, job)) continue; // they must be able to reach the console
    if ((prio[busy.category] ?? 0) <= level || sim.world.has(id, DraftedC) || isIncapacitated(sim, id) || isOffDuty(sim, id)) continue;
    const skill = skillOf(sim, id, consoleSkill(kind));
    if (skill > bestSkill) {
      best = id;
      bestSkill = skill;
    }
  }
  if (best) releaseAssignment(sim, best);
}
