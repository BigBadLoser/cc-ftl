import { BreakdownC } from '../crew/breakTypes';
import { CarriedC, CrewC, DeadC, DownedC, RecoveringC, DraftedC, JobC, NeedsC, PathC, PositionC, PrioritiesC, AssignmentC } from '../crew/components';
import { isIncapacitated } from '../crew/helpers';
import { EvaFloatC } from '../eva/components';
import { EquipOrderC, FighterC, SurrenderedC } from '../fight/components';
import { isBoarding, isOffDuty } from '../fight/relations';
import { InertC, StunC } from '../robots/components';
import type { Sim } from '../sim';
import { InterruptC, TaskC } from './components';
import { AI_LOG_KEEP } from './log';
import { hazardHolds } from './hazard';
import type { Interrupt, InterruptReason } from './types';

/**
 * The forced-state layer (docs/CREW_AI.md section 5), after the equip system so this tick's orders are seen. Phase 1 is a
 * read-only detector: it writes `Interrupt` from the precedence list below and counts, in `sim.aiLog`, every crew member for
 * whom it disagrees with the legacy test the scheduler still uses (`DraftedC`, `isIncapacitated`, `isOffDuty`). It aborts
 * nothing. `heldForMend` is reported but not compared: the legacy code handles it inside the scheduler's turn.
 *
 *   1 dead (not in the loop: corpses get none)  2 downed, carried, inert, stunned  3 floating (EVA transfer)  4 hazard (ai/hazard.ts;
 *   not while fighting)  5 breakdown, severe (panic, a combat freeze: beats a draft)  6 drafted  7 breakdown, moderate (hide, tantrum, despair,
 *   a freeze outside combat)  8 heldForMend  9 fight (fighting, fetching or stowing a weapon, surrendered, invading). A mild break (work
 *   refusal, isolation) is not an interrupt: the work drive scores 0 (content/policies.ts `willing`).
 */
export function interruptSystem(sim: Sim): void {
  const mend = mendTargets(sim);
  for (const id of sim.world.query(CrewC, PrioritiesC, PositionC, PathC, NeedsC)) {
    const reason = detect(sim, id, mend);
    // What the scheduler's turn keeps out of the normal loop: the legacy tests plus the hazard interrupt it applies itself.
    const legacy = sim.world.has(id, DraftedC) || isIncapacitated(sim, id) || isOffDuty(sim, id) || reason === 'hazard' || reason === 'breakdown';
    const forced = reason !== null && reason !== 'heldForMend';
    if (forced !== legacy) {
      sim.aiLog.interruptMismatches++;
      sim.aiLog.recent.push({ tick: sim.tick, crew: id, reason, legacy });
      if (sim.aiLog.recent.length > AI_LOG_KEEP) sim.aiLog.recent.shift();
    }
    if (!reason) {
      sim.world.remove(id, InterruptC);
      continue;
    }
    const cur = sim.world.get(id, InterruptC);
    const { mode, owner } = shape(sim, id, reason);
    if (cur && cur.reason === reason) {
      cur.mode = mode;
      cur.owner = owner;
    } else sim.world.add(id, InterruptC, { reason, mode, owner, since: sim.tick });
  }
}

/** Robots a crew mender has taken the mend job for (`heldForMend`), found once per tick. */
function mendTargets(sim: Sim): Set<number> {
  const out = new Set<number>();
  for (const j of sim.world.query(JobC)) {
    const job = sim.world.get(j, JobC);
    if (job?.kind === 'mend' && job.reservedBy !== 0) out.add(job.target ?? 0);
  }
  return out;
}

/** The highest-precedence forced reason that holds for the crew member, or null. */
export function detect(sim: Sim, id: number, mend?: ReadonlySet<number>): InterruptReason | null {
  if (sim.world.has(id, DeadC)) return 'dead';
  if (sim.world.has(id, DownedC) || sim.world.has(id, RecoveringC)) return 'downed';
  if (sim.world.has(id, CarriedC)) return 'carried';
  if (sim.world.has(id, InertC)) return 'inert';
  if (sim.world.has(id, StunC)) return 'stunned';
  if (sim.world.has(id, EvaFloatC)) return 'floating';
  // Fighting crew are steered by the fight code, which keeps them where the fight is (not yet hazard-aware).
  const f = sim.world.get(id, FighterC);
  const fighting = (f && f.mode !== 'idle') || sim.world.has(id, EquipOrderC) || sim.world.has(id, SurrenderedC) || isBoarding(sim, id);
  if (!fighting && hazardHolds(sim, id)) return 'hazard';
  const running = sim.world.get(id, BreakdownC);
  const brk = running?.suspended ? undefined : running; // a survival drive is critical: handled as if there were no break (`BreakdownC.suspended`)
  if (brk?.tier === 'severe') return 'breakdown';
  if (sim.world.has(id, DraftedC)) return 'drafted';
  if (brk?.tier === 'moderate') return 'breakdown';
  if (mend ? mend.has(id) : mendTargets(sim).has(id)) return 'heldForMend';
  if (fighting) return 'fight';
  return null;
}

/** How a reason treats the task (section 5) and who steers the path while it stands. */
function shape(sim: Sim, id: number, reason: InterruptReason): Pick<Interrupt, 'mode' | 'owner'> {
  switch (reason) {
    case 'dead': return { mode: 'sweep', owner: 'none' };
    case 'floating': return { mode: 'hold', owner: 'none' };
    case 'drafted': {
      // A drafted crew member ordered to a console keeps it (man.ts): the hold stands.
      const job = sim.world.get(sim.world.get(id, AssignmentC)?.jobId ?? 0, JobC);
      return { mode: job?.kind === 'operate' ? 'hold' : 'abort', owner: 'drafted' };
    }
    case 'heldForMend': return { mode: 'abort', owner: 'none' };
    // The escape task is stepped under the interrupt (owner executor); a drafted crew member is stepped off by it too.
    case 'hazard': case 'breakdown': return { mode: 'abort', owner: 'executor' };
    case 'fight': return { mode: sim.world.get(id, TaskC)?.class === 'finish' ? 'hold' : 'abort', owner: 'fight' };
    default: return { mode: 'abort', owner: 'none' };
  }
}
