import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { ProductionC } from '../items/components';
import { needsFrom } from '../items/materials';
import { nextOrder, orderWantsMore, suppliableOrder } from '../items/production';
import { refKey, reservations, totalStock, type Reservations } from '../items/stock';
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
  let res: Reservations | undefined;
  for (const [moduleId, jobId] of existing) {
    const job = sim.world.get(jobId, JobC);
    const orders = sim.world.get(moduleId, ProductionC)?.orders ?? [];
    const live = orders.some((o) => o.recipe === job?.craft?.recipe && orderWantsMore(sim, o));
    // A job whose inputs can no longer come (not in stock, not delivered, not on their way: an ore carried to it still counts) gives way to an
    // order that can really be supplied now. Never to one that cannot: that would only swap one waiting job for another.
    const starved = !!job?.craft && job.progress === 0 && !job.delivered?.length && !inputsComing(sim, jobId, job.craft.recipe, (res ??= reservations(sim)))
      && suppliableOrder(sim, moduleId, job.craft.recipe) !== null;
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

/** Can the job's inputs still all arrive: delivered, in hauls on their way to it (picked up or not), or in the player's stock? */
function inputsComing(sim: Sim, jobId: number, recipeId: string, res: Reservations): boolean {
  const recipe = sim.content.recipes[recipeId];
  const job = sim.world.get(jobId, JobC);
  if (!recipe || !job) return false;
  return recipe.inputs.every((l) => {
    const delivered = job.delivered?.find((d) => d.item === l.item)?.count ?? 0;
    const coming = res.incoming.get(refKey('job', jobId, l.item)) ?? 0;
    return delivered + coming + totalStock(sim, l.item) >= l.count;
  });
}
