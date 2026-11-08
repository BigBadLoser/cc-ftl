import { JobC } from '../crew/components';
import type { Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { consumeDelivered } from '../items/materials';
import { ModuleC } from '../modules/components';
import { accessTile } from '../modules/footprint';
import { shipIdOf } from '../regions';
import type { Sim } from '../sim';
import { assemblyAt } from '../robots/bay';
import { VehicleBayC } from './components';
import { spawnVehicle } from './lifecycle';

/** The vehicle a bay builds by default: the first def (by id) of the bay's class that can be built, or null. */
export function buildableFor(sim: Sim, bay: number): string | null {
  const m = sim.world.get(bay, ModuleC);
  const cls = m && sim.content.modules[m.def]?.vehicleBay?.class;
  if (!cls) return null;
  return Object.keys(sim.content.vehicles ?? {}).sort().find((id) => sim.content.vehicles?.[id]?.class === cls && !!sim.content.vehicles[id]?.assemble) ?? null;
}

/** Why a vehicle cannot be built in this bay now ('noBay', 'bayFull', 'bayDown', 'bayTaken', 'badVehicle'), or null. */
export function buildError(sim: Sim, bay: number, vehicle: string | null): string | null {
  const b = sim.world.get(bay, VehicleBayC);
  const m = sim.world.get(bay, ModuleC);
  if (!b || !m) return 'noBay';
  if (b.vehicle) return 'bayFull';
  if (m.hp <= 0) return 'bayDown';
  if (assemblyAt(sim, bay)) return 'bayTaken';
  const def = vehicle ? sim.content.vehicles?.[vehicle] : undefined;
  if (!def?.assemble || def.class !== sim.content.modules[m.def]?.vehicleBay?.class) return 'badVehicle';
  return null;
}

/** Post the build: an 'assemble' job at the bay's access tile, its materials delivered there like any construction. */
export function postVehicleBuild(sim: Sim, bay: number, vehicle: string): void {
  const m = sim.world.get(bay, ModuleC) as { def: string; x: number; y: number; rot: number };
  const def = sim.content.modules[m.def];
  const plan = sim.content.vehicles?.[vehicle]?.assemble;
  if (!def || !plan) return;
  const at = accessTile(def, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
  const job = sim.world.createEntity();
  sim.world.add(job, JobC, {
    category: 'crafting', kind: 'assemble', x: at.x, y: at.y, struct: 0, work: plan.work, progress: 0, reservedBy: 0, target: bay, assemble: { vehicle },
    ...(plan.cost.length > 0 ? { needs: plan.cost.map((q) => ({ ...q })), delivered: [] } : {}),
  });
}

/** Assemble a vehicle: once the materials are in, `work` ticks; then it stands stowed in the bay. A bay filled meanwhile (an item fitted) ends the job. */
export function performVehicleAssemble(sim: Sim, job: Job, speed: number): WorkResult {
  const bay = job.target ?? 0;
  const m = sim.world.get(bay, ModuleC);
  const vehicle = job.assemble?.vehicle;
  if (!m || m.hp <= 0 || !vehicle || sim.world.get(bay, VehicleBayC)?.vehicle) return 'done';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  const id = spawnVehicle(sim, vehicle, bay);
  consumeDelivered(job);
  sim.events.emit({ type: 'vehicle.assembled', vehicle: id, bay, ship: shipIdOf(sim, m) });
  return 'done';
}
