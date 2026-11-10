import { JobC, type Job } from '../crew/components';
import type { WorkResult } from '../crew/jobWork';
import { consumeDelivered, missingMaterials, needsFrom, needsMaterials } from '../items/materials';
import { destroyJob } from '../items/stacks';
import { refKey, reservations, shipStoreCount } from '../items/stock';
import { shipIdOf } from '../regions';
import type { ModuleDef } from '../registry';
import type { Sim } from '../sim';
import { PLAN_INTERVAL } from '../tuning';
import { ModuleC } from './components';
import { burnsFuel, fuelOf } from './energy';
import { shipGrid } from '../regions';
import { rotatedSize } from './footprint';
import { isTileWalkable } from './walk';

/** Ticks of work (at work speed 1) to load a reactor's store once the fuel is at its side. */
export const REFUEL_WORK = 20;

/**
 * The tile a crew member stands on to load a solid module (the haul delivers there too): the first walkable tile on the ring around its
 * footprint, scanning the north side, then east, south and west. Null when the module is walled in.
 */
function standTile(sim: Sim, ship: number, def: ModuleDef, m: { x: number; y: number; rot: number }): { x: number; y: number } | null {
  const grid = shipGrid(sim, ship);
  if (!grid) return null;
  const [w, h] = rotatedSize(def, m.rot);
  const ring: { x: number; y: number }[] = [];
  for (let i = 0; i < w; i++) ring.push({ x: m.x + i, y: m.y - 1 });
  for (let j = 0; j < h; j++) ring.push({ x: m.x + w, y: m.y + j });
  for (let i = w - 1; i >= 0; i--) ring.push({ x: m.x + i, y: m.y + h });
  for (let j = h - 1; j >= 0; j--) ring.push({ x: m.x - 1, y: m.y + j });
  return ring.find((t) => isTileWalkable(sim, grid, t.x, t.y)) ?? null;
}

/**
 * Reactor refuelling (issue #421), every PLAN_INTERVAL ticks. A reactor on a ship that burns fuel (`burnsFuel`) whose store has fallen below
 * `ModuleDef.fuel.refillBelow` gets one 'refuel' job while the ship's stores hold some of its fuel; the supply planner (systems/supplyJobs.ts)
 * hauls the fuel to the job like a build's materials, and the crew member loads it (`performRefuel`). A job the reactor no longer wants
 * (store full again, reactor gone or wrecked, the fuel used up elsewhere before any was fetched) is dropped.
 */
export function refuelSystem(sim: Sim): void {
  if (sim.tick % PLAN_INTERVAL !== 0) return;
  const res = reservations(sim);
  const jobs = new Map<number, number>();
  for (const jid of sim.world.query(JobC)) {
    const j = sim.world.get(jid, JobC);
    if (j?.kind === 'refuel') jobs.set(j.target ?? 0, jid);
  }
  for (const [moduleId, jid] of jobs) {
    const job = sim.world.get(jid, JobC) as Job;
    const m = sim.world.get(moduleId, ModuleC);
    const def = m && sim.content.modules[m.def];
    const started = job.progress > 0 || !!job.delivered?.length;
    if (!m || !def?.fuel || m.hp <= 0 || fuelOf(m, def) >= def.fuel.store || !burnsFuel(sim, shipIdOf(sim, m)) || (!started && fuelOf(m, def) >= def.fuel.refillBelow)) {
      destroyJob(sim, jid);
      jobs.delete(moduleId);
      continue;
    }
    // The stores ran short of what the job asked for (used elsewhere) and nothing is on its way: settle for what is there, so the reactor still gets it.
    const item = def.fuel.item;
    const missing = missingMaterials(job).find((q) => q.item === item)?.count ?? 0;
    const inFlight = res.incoming.get(refKey('job', jid, item)) ?? 0;
    const stock = shipStoreCount(sim, shipIdOf(sim, m), item);
    if (missing > 0 && inFlight === 0 && stock < missing) {
      const got = (job.delivered ?? []).filter((q) => q.item === item).reduce((n, q) => n + q.count, 0);
      if (got + stock <= 0) {
        destroyJob(sim, jid);
        jobs.delete(moduleId);
      } else if (job.needs?.[0]) job.needs[0].count = got + stock;
    }
  }
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def?.fuel || jobs.has(id) || m.hp <= 0 || fuelOf(m, def) >= def.fuel.refillBelow) continue;
    const ship = shipIdOf(sim, m);
    if (!burnsFuel(sim, ship) || shipStoreCount(sim, ship, def.fuel.item) <= 0) continue;
    const at = standTile(sim, ship, def, m);
    if (!at) continue;
    // Ask for the top-up, or for all there is when the stores hold less: a reactor with one crystal to be had still gets it.
    const room = Math.min(Math.floor(def.fuel.store - fuelOf(m, def)), shipStoreCount(sim, ship, def.fuel.item));
    sim.world.add(sim.world.createEntity(), JobC, {
      category: 'hauling', kind: 'refuel', ...at, struct: 0, work: REFUEL_WORK, progress: 0, reservedBy: 0, target: id,
      needs: needsFrom([{ item: def.fuel.item, count: Math.max(1, room) }]), delivered: [],
    });
  }
}

/** One tick of loading a reactor: waits for the fuel to be delivered, works, then the delivered units go into the store (never past `store`). */
export function performRefuel(sim: Sim, job: Job, speed: number): WorkResult {
  const m = sim.world.get(job.target ?? 0, ModuleC);
  const def = m && sim.content.modules[m.def];
  if (!m || !def?.fuel || m.hp <= 0) return 'done';
  if (needsMaterials(job)) return 'wait';
  job.progress = Math.min(job.work, job.progress + speed);
  if (job.progress < job.work) return 'working';
  const got = (job.delivered ?? []).filter((q) => q.item === def.fuel?.item).reduce((n, q) => n + q.count, 0);
  m.fuel = Math.min(def.fuel.store, fuelOf(m, def) + got);
  consumeDelivered(job);
  return 'done';
}
