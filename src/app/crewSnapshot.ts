import {
  AssignmentC, CarriedC, CarryingC, CrewC, DeadC, DownedC, DraftedC, HealthC, JobC, NeedsC, PositionC, PrioritiesC, Struct,
  WORK_CATEGORIES, type Job, type Sim, type WorkCategory,
} from '../sim';
import type { UiCrew } from '../ui/api';

const STRUCT_LABEL: Record<number, string> = Object.fromEntries(Object.entries(Struct).map(([k, v]) => [v, k.toLowerCase()]));
const NONE = Object.fromEntries(WORK_CATEGORIES.map((c) => [c, 0])) as Record<WorkCategory, number>;

function jobLabel(sim: Sim, j: Job): string {
  const mod = j.module ? (sim.content.modules[j.module.def]?.name ?? 'module') : 'module';
  switch (j.kind) {
    case 'build': return `Building ${STRUCT_LABEL[j.struct] ?? 'structure'}`;
    case 'deconstruct': return 'Deconstructing';
    case 'module': return `Building ${mod}`;
    case 'moduleDecon': return 'Deconstructing module';
    case 'extinguish': return 'Fighting fire';
    case 'repair': return 'Repairing';
    case 'rescue': return 'Rescuing crew';
    case 'haul': return 'Hauling';
    case 'craft': return 'Crafting';
    default: return j.kind;
  }
}

/** Plain-data crew list for the UI. Reads the sim, never mutates it. */
export function buildCrewList(sim: Sim): UiCrew[] {
  const out: UiCrew[] = [];
  for (const id of sim.world.query(CrewC)) {
    const crew = sim.world.get(id, CrewC);
    if (!crew || sim.world.get(id, PositionC)?.gridId !== 1) continue; // the player's ship only
    const role = sim.content.roles[crew.role];
    let job: string | null = null;
    const a = sim.world.get(id, AssignmentC);
    const j = a && sim.world.get(a.jobId, JobC);
    if (j) {
      const pct = Math.round((j.progress / Math.max(1, j.work)) * 100);
      job = `${jobLabel(sim, j)} at ${j.x},${j.y} (${pct}%)`;
    }
    const hp = sim.world.get(id, HealthC);
    const downed = sim.world.get(id, DownedC);
    const carrier = sim.world.get(id, CarriedC);
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
      hp: Math.round(hp?.hp ?? 100),
      maxHp: hp?.max ?? 100,
      dead: sim.world.has(id, DeadC),
      downed: downed ? { bleed: Math.round(downed.bleed), stabilized: downed.stabilized } : null,
      carriedBy: carrier ? (sim.world.get(carrier.carrier, CrewC)?.name ?? null) : null,
      carrying: sim.world.get(id, CarryingC) ?? null,
    });
  }
  return out;
}
