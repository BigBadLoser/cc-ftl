import { abortTask } from '../ai/task';
import { DeadC, DownedC, JobC, PositionC, type Job } from '../crew/components';
import { injuriesOf } from '../crew/body';
import { OperationsC } from '../crew/implantTypes';
import { queueOperation } from '../crew/surgeryHandlers';
import { lyingIn, operationError, operationSec, operationsOf, readyOperation, stockFor, surgeryJobOf, theatreFits } from '../crew/surgery';
import { SURGERY_STEP_TICKS } from '../crew/tuningSurgery';
import { shipStoreCount } from '../items/stock';
import { ModuleC } from '../modules/components';
import { AllegianceC } from '../fight/components';
import { moduleSite } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';

/**
 * The surgery planner (#311), every `SURGERY_STEP_TICKS`:
 *  - a downed crew member of the player's whose heart or lungs are lost gets an urgent replacement queued at the front, when one is in stock on their ship (the best tier);
 *  - an operation at the head of a queue that no longer applies (the part healed, the implant came out) leaves it;
 *  - a surgery job (medical) is posted for a patient lying where their ready operation can be done (crew/surgery.ts `theatreFits`), and dropped once that stops being so.
 * The patient gets there by the recover drive or a rescue (crew/beds.ts `bedUseOf`); the job's end is crew/surgeryOutcome.ts.
 */
export function surgerySystem(sim: Sim): void {
  if (sim.tick % SURGERY_STEP_TICKS !== 0) return;
  for (const id of sim.world.query(DownedC, PositionC)) queueUrgent(sim, id);
  for (const id of [...sim.world.query(OperationsC)]) tidy(sim, id);
  for (const jobId of [...sim.world.query(JobC)]) {
    const job = sim.world.get(jobId, JobC) as Job;
    if (job.kind !== 'surgery' || keep(sim, job)) continue;
    if (job.reservedBy) abortTask(sim, job.reservedBy, 'cancelled');
    sim.world.destroyEntity(jobId);
  }
  for (const id of sim.world.query(OperationsC, PositionC)) post(sim, id);
}

/** A lost heart or lungs with a replacement in stock and none queued: queue the best one, urgent. */
function queueUrgent(sim: Sim, id: number): void {
  const parts = sim.content.injuries?.parts;
  const pos = sim.world.get(id, PositionC);
  if (!parts || !pos || sim.world.has(id, DeadC) || sim.world.get(id, AllegianceC)?.faction !== 'player') return; // the player's own stock, for their own people
  for (const inj of injuriesOf(sim, id)) {
    const def = parts[inj.part];
    if (inj.sev !== 'destroyed' || !def?.vital || def.slot === 'brain' || operationsOf(sim, id).some((o) => o.part === inj.part)) continue;
    let best: { item: string; tier: number } | null = null;
    for (const [item, d] of Object.entries(sim.content.items)) {
      const imp = d.implant;
      if (imp?.kind !== 'replacement' || imp.slot !== def.slot || (best && imp.tier <= best.tier) || shipStoreCount(sim, shipIdOf(sim, pos), item) < 1) continue;
      best = { item, tier: imp.tier };
    }
    if (best) queueOperation(sim, id, { kind: 'fit', part: inj.part, item: best.item });
  }
}

/** Drop head operations that no longer apply. */
function tidy(sim: Sim, id: number): void {
  const ops = sim.world.get(id, OperationsC);
  if (!ops) return;
  if (sim.world.has(id, DeadC)) ops.list = [];
  while (ops.list[0] && operationError(sim, id, ops.list[0])) ops.list.shift();
  if (!ops.list.length) sim.world.remove(id, OperationsC);
}

/** A surgery job holds while its patient lies in its bed, its operation is still the ready head of the queue and the bed still fits it. */
function keep(sim: Sim, job: Job): boolean {
  const id = job.target ?? 0;
  const op = readyOperation(sim, id);
  return !sim.world.has(id, DeadC) && !!op && op.id === job.surgery?.op && lyingIn(sim, id) === job.bed && theatreFits(sim, job.bed ?? 0, op) && stockFor(sim, id, op);
}

function post(sim: Sim, id: number): void {
  const op = readyOperation(sim, id);
  const bed = lyingIn(sim, id);
  if (!op || !bed || !theatreFits(sim, bed, op) || surgeryJobOf(sim, id)) return;
  const m = sim.world.get(bed, ModuleC);
  if (!m) return;
  const job: Job = {
    category: 'medical', kind: 'surgery', ...moduleSite(sim.content.modules[m.def], m), target: id, bed, surgery: { op: op.id },
    struct: 0, work: operationSec(sim, id, op) * TICK_HZ, progress: 0, reservedBy: 0,
  };
  sim.world.add(sim.world.createEntity(), JobC, job);
}
