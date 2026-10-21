import { CrewC, JobC, PositionC, type Job } from '../crew/components';
import { isIncapacitated, isSettled } from '../crew/helpers';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { stat, type StatName } from '../stats';
import { IonC } from './components';
import { shipIdOf } from '../regions';

export type ConsoleKind = 'weapons' | 'shields' | 'helm';

const SKILL_OF: Record<ConsoleKind, StatName> = { weapons: 'gunnery', shields: 'shielding', helm: 'piloting' };

/** A crew member's skill level, 0 if the crew is unknown to the stat resolver. */
export function skillOf(sim: Sim, crew: number, name: StatName): number {
  const c = sim.world.get(crew, CrewC);
  return c && sim.content.species[c.species] ? stat(sim, crew, name) : 0;
}

/** The skill that makes a crew member good at a console. */
export function consoleSkill(kind: ConsoleKind): StatName {
  return SKILL_OF[kind];
}

/** Who is manning a console module right now: the crew member standing on its access tile with the job, or 0. */
export function operatorOf(sim: Sim, moduleId: number): number {
  for (const jobId of sim.world.query(JobC)) {
    const job = sim.world.get(jobId, JobC);
    if (job?.kind !== 'operate' || job.target !== moduleId || job.reservedBy === 0) continue;
    const pos = sim.world.get(job.reservedBy, PositionC);
    const crew = sim.world.get(job.reservedBy, CrewC);
    if (!pos || !crew || crew.activity === 'sleeping' || isIncapacitated(sim, job.reservedBy)) continue;
    if (isSettled(pos) && pos.x === job.x && pos.y === job.y && shipIdOf(sim, pos) === shipIdOf(sim, job)) return job.reservedBy;
  }
  return 0;
}

/** A powered console of a kind on a grid that someone is manning: its module and operator. */
export function mannedConsole(sim: Sim, shipId: number, kind: ConsoleKind): { module: number; crew: number } | null {
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    if (!m || shipIdOf(sim, m) !== shipId || sim.content.modules[m.def]?.console !== kind) continue;
    if (!m.powered || m.hp <= 0 || sim.world.has(id, IonC)) continue;
    const crew = operatorOf(sim, id);
    if (crew) return { module: id, crew };
  }
  return null;
}

/** Operator skill level at a console kind of a grid (0 if unmanned). */
export function operatorSkill(sim: Sim, shipId: number, kind: ConsoleKind): number {
  const op = mannedConsole(sim, shipId, kind);
  return op ? skillOf(sim, op.crew, SKILL_OF[kind]) : 0;
}

/** Path-score bonus that makes skilled crew prefer their own console (and others the rest). */
export function operateAffinity(sim: Sim, crew: number, job: Job): number {
  if (job.kind !== 'operate') return 0;
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const kind = m && sim.content.modules[m.def]?.console;
  return kind ? skillOf(sim, crew, SKILL_OF[kind]) * 100 : 0;
}
