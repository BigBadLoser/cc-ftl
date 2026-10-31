import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { ProductionC } from '../items/components';
import { needsFrom } from '../items/materials';
import { inputsInStock, nextOrder, orderWantsMore } from '../items/production';
import { destroyJob } from '../items/stacks';
import type { Sim } from '../sim';
import { PLAN_INTERVAL } from '../tuning';

/**
 * Keeps one craft job per crafting module that has an order wanting a batch, preferring an order whose inputs are in stock (`nextOrder`). The
 * job starts in 'needsMaterials' (inputs are fetched by the supply planner). A job that has not started is
 * dropped when its order is removed or satisfied, returning delivered inputs to the floor.
 */
export function craftJobsSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const existing = new Map<number, number>();
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'craft') existing.set(j.target ?? 0, id);
  }
  for (const [moduleId, jobId] of existing) {
    const job = sim.world.get(jobId, JobC);
    const orders = sim.world.get(moduleId, ProductionC)?.orders ?? [];
    const live = orders.some((o) => o.recipe === job?.craft?.recipe && orderWantsMore(sim, o));
    // A job still waiting for inputs that are not in stock gives way to an order whose inputs are (nothing delivered yet, so nothing to drop).
    const starved = !!job?.craft && job.progress === 0 && !job.delivered?.length && !inputsInStock(sim, job.craft.recipe)
      && nextOrder(sim, moduleId)?.recipe !== job.craft.recipe;
    if (!job || !sim.world.has(moduleId, ModuleC) || (job.progress === 0 && !live) || starved) {
      destroyJob(sim, jobId);
      existing.delete(moduleId);
    }
  }
  for (const moduleId of sim.world.query(ProductionC, ModuleC)) {
    const m = sim.world.get(moduleId, ModuleC);
    if (!m || existing.has(moduleId) || !m.enabled || m.hp <= 0) continue;
    const order = nextOrder(sim, moduleId);
    const recipe = order && sim.content.recipes[order.recipe];
    if (!order || !recipe || recipe.station !== m.def) continue;
    const id = sim.world.createEntity();
    sim.world.add(id, JobC, {
      category: recipe.category ?? 'crafting', kind: 'craft', x: m.x, y: m.y, struct: 0, work: recipe.work, progress: 0,
      reservedBy: 0, target: moduleId, needs: needsFrom(recipe.inputs), delivered: [], craft: { recipe: order.recipe },
    });
  }
}
