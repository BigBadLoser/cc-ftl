import type { Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { accessTile } from '../modules/footprint';
import { ModuleC } from '../modules/components';
import { skillOf } from '../combat/operators';
import type { RecipeDef } from '../registry';
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
export function performCraft(sim: Sim, job: Job, speed: number, crew = 0): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const recipe = job.craft && sim.content.recipes[job.craft.recipe];
  const def = m && sim.content.modules[m.def];
  if (!m || !def || !recipe) return 'done';
  if (needsMaterials(job) || !m.powered || m.hp <= 0) return 'wait';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';

  consumeDelivered(job);
  const at = accessTile(def, m.x, m.y, m.rot) ?? { x: m.x, y: m.y };
  const made = recipe.outputs.map((out, i) => (i === 0 ? { ...out, item: qualityItem(sim, recipe, crew) ?? out.item } : out));
  for (const out of made) spillItems(sim, shipIdOf(sim, job), at.x, at.y, out.item, out.count);
  for (const x of recipe.extras ?? []) if (sim.rng.chance(x.chance)) spillItems(sim, shipIdOf(sim, job), at.x, at.y, x.item, x.count);
  const orders = sim.world.get(job.target ?? 0, ProductionC)?.orders ?? [];
  const order = orders.find((o) => o.recipe === job.craft?.recipe && (o.mode === 'keep' || o.done < o.target));
  if (order) order.done++;
  sim.events.emit({ type: 'production.done', module: job.target ?? 0, recipe: job.craft?.recipe ?? '', ship: shipIdOf(sim, job), x: at.x, y: at.y });
  return 'done';
}

/** The item a quality recipe (a meal) turns out for this cook: the best tier their skill reaches, null for a recipe without quality. */
export function qualityItem(sim: Sim, recipe: RecipeDef, cook: number): string | null {
  const q = recipe.quality;
  if (!q) return null;
  const skill = cook ? skillOf(sim, cook, q.skill) : 0;
  return q.tiers.reduce((best, t) => (skill >= t.minSkill ? t.item : best), q.tiers[0]?.item ?? recipe.outputs[0]?.item ?? null);
}
