import type { Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { accessTile } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { ProductionC } from './components';
import { consumeDelivered, needsMaterials } from './materials';
import { spillItems } from './stacks';
import { shipIdOf } from '../regions';

/**
 * One tick of crafting at a station: waits for inputs and for power, then works. On completion the
 * inputs are used up, the outputs land on the module's access tile (or nearest free floor), and the
 * matching order counts one batch. Hauling then carries the outputs to storage.
 */
export function performCraft(sim: Sim, job: Job, speed: number): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const recipe = job.craft && sim.content.recipes[job.craft.recipe];
  const def = m && sim.content.modules[m.def];
  if (!m || !def || !recipe) return 'done';
  if (needsMaterials(job) || !m.powered || m.hp <= 0) return 'wait';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';

  consumeDelivered(job);
  const at = accessTile(def, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
  for (const out of recipe.outputs) spillItems(sim, shipIdOf(sim, job), at.x, at.y, out.item, out.count);
  const orders = sim.world.get(job.target ?? 0, ProductionC)?.orders ?? [];
  const order = orders.find((o) => o.recipe === job.craft?.recipe && (o.mode === 'keep' || o.done < o.target));
  if (order) order.done++;
  sim.events.emit({ type: 'production.done', module: job.target ?? 0, recipe: job.craft?.recipe ?? '', ship: shipIdOf(sim, job), x: at.x, y: at.y });
  return 'done';
}
