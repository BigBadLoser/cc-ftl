import { CrewC, type Job, type Position, type Priorities } from '../crew/components';
import { freeOperatorFor, jobFits } from '../crew/jobFit';
import { operateAffinity } from '../combat/operators';
import { ModuleC } from '../modules/components';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { EVA_JOB_PENALTY, OPERATE_MAX_LEVEL, RELIEF_AFTER_SEC, RELIEF_PENALTY } from '../tuning';

/**
 * What the scheduler (ai/scheduler.ts) ranks a (crew member, job) pair by, apart from the walk (docs/CREW_AI.md 7.1). The tuple is
 * `(level, -urgency, pathCost + pairCost, jobId, crewId)`: `admitLevel` gives the level and whether the pair is a console relief, `repairUrgency`
 * the urgency, `pairCost` the integer terms added to the path cost. The rules are the legacy picker's (moved here unchanged), in path cost units.
 */

/** True if an empty console may be relieved by crew whose operating priority is low: in a fight, left empty for RELIEF_AFTER_SEC, and one that matters unmanned (the shield console works at base strength without an operator). */
function canRelieve(sim: Sim, crewId: number, job: Job): boolean {
  const role = sim.world.get(crewId, CrewC)?.role;
  if (!role || !sim.content.roles[role]?.relievesStations || !sim.sector.inCombat || sim.tick - (job.freeSince ?? sim.tick) < RELIEF_AFTER_SEC * TICK_HZ) return false;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  return !!m && sim.content.modules[m.def]?.console !== 'shields' && freeOperatorFor(sim, shipIdOf(sim, m), job) === 0;
}

/**
 * Whether the crew member may take the job at this priority level: the job's category is at `level` for them, it fits (`jobFits`), and a
 * console above OPERATE_MAX_LEVEL only as a relief in a fight. Returns null when not admitted, else whether it is a relief.
 */
export function admitLevel(sim: Sim, crewId: number, pos: Position, prio: Priorities, job: Job, level: number): { relief: boolean } | null {
  if (prio[job.category] !== level || !jobFits(sim, crewId, pos, job)) return null;
  const relief = job.kind === 'operate' && level > OPERATE_MAX_LEVEL;
  if (relief && !canRelieve(sim, crewId, job)) return null;
  return { relief };
}

/** Urgency bonuses that put repair jobs in order: a manual priority repair beats combat triage, which beats the rest. */
const MANUAL_REPAIR_BONUS = 100000;
const FIGHT_REPAIR_BONUS = 20000;
const SUPPORT_REPAIR_BONUS = 10000;

/**
 * A priority-repair module's repair job beats any walking distance; a later order goes first. In combat the rest are triaged by what
 * the fight needs: weapons (and their console), reactors, shield generators and consoles and the helm come first, engines and life
 * support next, then everything else (lights, beds, storage) by distance as usual. Outside combat nothing changes.
 */
export function repairUrgency(sim: Sim, job: Job): number {
  if (job.kind !== 'repair') return 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  if (!m) return 0;
  if (m.repairFirst) return MANUAL_REPAIR_BONUS + m.repairFirst;
  if (!sim.sector.inCombat) return 0;
  const def = sim.content.modules[m.def];
  if (!def) return 0;
  if (def.console || def.weapon || def.shieldGen || def.power > 0) return FIGHT_REPAIR_BONUS;
  return def.engine || def.o2PerSec ? SUPPORT_REPAIR_BONUS : 0;
}

/**
 * Integer terms added to the path cost (x10 units, 10 per tile) of a pair: the EVA penalty for a thin-air walk, the relief penalty (a relief
 * takes the console only when nothing else of their rank waits), minus the operator's affinity for the console. They reorder pairs only
 * within one (level, urgency). Every term must be known from (crew, job, walk mode) before any search, so the bounded and the exact searches
 * see the same tuple. A trait cost (docs/TRAITS.md section 5, e.g. a phobia of the job's room) is added here.
 */
export function pairCost(sim: Sim, crewId: number, job: Job, thin: boolean, relief: boolean): number {
  return 10 * ((thin ? EVA_JOB_PENALTY : 0) + (relief ? RELIEF_PENALTY : 0) - operateAffinity(sim, crewId, job));
}
