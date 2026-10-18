import { CrewC, DeadC, HealthC, ModuleC, NeedsC, TICK_HZ, totalStock, type Sim } from '../sim';
import { assemblyAt } from '../sim/robots/bay';
import { JobC } from '../sim/crew/components';
import { costsOf } from './logisticsSnapshot';
import type { UiRobotBay } from '../ui/api';

/** Plain-data state of a robot bay for its panel: the robot living in it, the assembly under way, and what it could build. Reads the sim only. */
export function buildRobotBay(sim: Sim, bay: number): UiRobotBay | null {
  const m = sim.world.get(bay, ModuleC);
  if (!m || !sim.content.modules[m.def]?.robotBay) return null;
  const r = m.reservedBy && !sim.world.has(m.reservedBy, DeadC) ? sim.world.get(m.reservedBy, CrewC) : undefined;
  const hp = r && sim.world.get(m.reservedBy, HealthC);
  const needs = r && sim.world.get(m.reservedBy, NeedsC);
  const jobId = assemblyAt(sim, bay);
  const job = jobId ? sim.world.get(jobId, JobC) : undefined;
  const role = job?.assemble?.role;
  const plan = role ? sim.content.roles[role]?.assemble : undefined;
  return {
    occupant: r ? {
      id: m.reservedBy, name: r.name, role: sim.content.roles[r.role]?.name ?? r.role, charging: r.activity === 'charging',
      charge: Math.round(needs?.charge ?? 100), hp: Math.round(hp?.hp ?? 0), maxHp: hp?.max ?? 0,
    } : null,
    assembling: job && role && plan ? {
      role, name: sim.content.roles[role]?.name ?? role, progress: Math.min(1, job.progress / Math.max(1, job.work)),
      waiting: !!job.needs && job.needs.some((q) => (job.delivered?.find((d) => d.item === q.item)?.count ?? 0) < q.count),
      cost: costsOf(sim, plan.cost),
    } : null,
    options: Object.entries(sim.content.roles).flatMap(([id, d]) => d.assemble ? [{
      role: id, name: d.name, seconds: Math.round(d.assemble.work / TICK_HZ),
      cost: costsOf(sim, d.assemble.cost).map((c) => ({ ...c, have: totalStock(sim, c.item) })),
    }] : []),
  };
}
