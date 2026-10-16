import {
  AssignmentC, CrewC, DraftedC, JobC, NeedsC, PrioritiesC, Struct, WORK_CATEGORIES, type Sim, type WorkCategory,
} from '../sim';
import type { UiCrew } from '../ui/api';

const STRUCT_LABEL: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k.toLowerCase()]));
const NONE = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as Record<WorkCategory, number>;

/** Plain-data crew list for the UI. Reads the sim, never mutates it. */
export function buildCrewList(sim: Sim): UiCrew[] {
  const out: UiCrew[] = [];
  for (const id of sim.world.query(CrewC)) {
    const crew = sim.world.get(id, CrewC);
    if (!crew) continue;
    const role = sim.content.roles[crew.role];
    let job: string | null = null;
    const a = sim.world.get(id, AssignmentC);
    const j = a && sim.world.get(a.jobId, JobC);
    if (j) {
      const pct = Math.round((j.progress / Math.max(1, j.work)) * 100);
      const what = j.kind === 'build' ? `Building ${STRUCT_LABEL[j.struct] ?? 'structure'}` : 'Deconstructing';
      job = `${what} at ${j.x},${j.y} (${pct}%)`;
    }
    out.push({
      id,
      name: crew.name,
      role: role?.name ?? crew.role,
      activity: crew.activity,
      rest: Math.round(sim.world.get(id, NeedsC)?.rest ?? 100),
      drafted: sim.world.has(id, DraftedC),
      job,
      priorities: { ...(sim.world.get(id, PrioritiesC) ?? NONE) },
      defaults: { ...(role?.priorities ?? NONE) },
    });
  }
  return out;
}
