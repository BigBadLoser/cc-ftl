import { ShipC } from '../combat/components';
import { JobC } from '../crew/components';
import { ModuleC } from '../modules/components';
import { isKnown, learn } from '../modules/blueprints';
import { nearestSource, reservations, sourcesOf, type Reservations } from '../items/stock';
import { spillItems, takeFromStack } from '../items/stacks';
import { storageTake } from '../items/storage';
import { shipIdOf } from '../regions';
import type { ResearchDef } from '../registry';
import type { Sim } from '../sim';
import { ResearchC, type Research } from './components';

/**
 * Research. Each player ship keeps a queue of projects (ResearchC); the head is the active one. When the head is first in line and the
 * ship holds its materials they are taken from stock at once (a project is paid in full when it starts), then crew work it as 'research' jobs,
 * one per research module (systems/researchJobs.ts). Every module's worker adds progress, so a second module speeds the one project up.
 * Finishing it learns the blueprints it unlocks, exactly like buying them.
 */
export const projectOf = (sim: Sim, id: string): ResearchDef | undefined => sim.content.research?.[id];

/** The ship's research modules that can work now: intact and enabled (power is checked when work is done). */
export function labsOf(sim: Sim, ship: number): number[] {
  return sim.world.query(ModuleC).filter((id) => {
    const m = sim.world.get(id, ModuleC);
    return !!m && sim.content.modules[m.def]?.research === true && shipIdOf(sim, m) === ship && m.hp > 0 && m.enabled;
  });
}

/** A project is finished (nothing left to learn) once every blueprint it unlocks is known. */
export const isDone = (sim: Sim, def: ResearchDef): boolean => def.unlocks.every((u) => isKnown(sim, u));

/** Every module a project requires is known, or unlocked by one of the `ahead` projects (those queued before it). */
export function requiresMet(sim: Sim, def: ResearchDef, ahead: readonly string[]): boolean {
  return (def.requires ?? []).every((r) => isKnown(sim, r) || ahead.some((p) => projectOf(sim, p)?.unlocks.includes(r)));
}

/** The queue is valid when every project's requirements are known or unlocked by a project before it. */
export function queueValid(sim: Sim, queue: readonly string[]): boolean {
  return queue.every((id, i) => { const d = projectOf(sim, id); return !!d && requiresMet(sim, d, queue.slice(0, i)); });
}

/** Why a project cannot be queued on a ship right now, or null. */
export function queueBlocker(sim: Sim, ship: number, project: string): string | null {
  const def = projectOf(sim, project);
  if (!def) return 'badProject';
  if (sim.world.get(ship, ShipC)?.faction !== 'player') return 'badShip';
  if (sim.world.get(ship, ResearchC)?.queue.includes(project)) return 'queued';
  if (isDone(sim, def)) return 'alreadyKnown';
  if (!requiresMet(sim, def, sim.world.get(ship, ResearchC)?.queue ?? [])) return 'locked';
  if (labsOf(sim, ship).length === 0) return 'noLab';
  return null;
}

/** Units of an item the ship holds that no pending haul has claimed (floor stacks and storage). */
export function stockOn(sim: Sim, ship: number, item: string, res: Reservations = reservations(sim)): number {
  return sourcesOf(sim, ship, item, res).reduce((n, s) => n + s.avail, 0);
}

/** The whole cost is in unreserved stock, judged on one reservation snapshot (the one `pay` then takes from). */
export function canPay(sim: Sim, ship: number, def: ResearchDef): boolean {
  const res = reservations(sim);
  return def.cost.every((c) => stockOn(sim, ship, c.item, res) >= c.count);
}

/**
 * Take a project's materials from the ship's unreserved stock, nearest first. All or nothing: if anything falls short (it should not after
 * `canPay`), what was taken is put back and false is returned.
 */
function pay(sim: Sim, ship: number, def: ResearchDef, from: { x: number; y: number }): boolean {
  const res = reservations(sim);
  const taken: { item: string; count: number }[] = [];
  let whole = true;
  for (const c of def.cost) {
    let left = c.count;
    while (left > 0) {
      const src = nearestSource(sim, ship, c.item, from, res);
      if (!src) break;
      const n = Math.min(left, src.avail);
      const got = src.ref.kind === 'floor' ? takeFromStack(sim, src.ref.id, n) : storageTake(sim, src.ref.id, c.item, n);
      if (got <= 0) break;
      left -= got;
      taken.push({ item: c.item, count: got });
    }
    if (left > 0) whole = false;
  }
  if (!whole) for (const t of taken) spillItems(sim, ship, from.x, from.y, t.item, t.count);
  return whole;
}

/** Put the project's materials back on the floor next to a research module. */
export function refund(sim: Sim, ship: number, def: ResearchDef): void {
  const at = labsOf(sim, ship)[0];
  const m = at ? sim.world.get(at, ModuleC) : undefined;
  if (!m) return;
  for (const c of def.cost) spillItems(sim, ship, m.x, m.y, c.item, c.count);
}

/** The head of the queue is paid for as soon as it can be: called by the research-jobs system. Returns true when `r` has an active project. */
export function startHead(sim: Sim, ship: number, r: Research): boolean {
  const def = projectOf(sim, r.queue[0] ?? '');
  if (!def) return false;
  if (r.paid) return true;
  const lab = labsOf(sim, ship)[0];
  const m = lab ? sim.world.get(lab, ModuleC) : undefined;
  if (!m || !requiresMet(sim, def, []) || !canPay(sim, ship, def)) return false;
  if (!pay(sim, ship, def, m)) return false;
  r.paid = true;
  r.progress = 0;
  return true;
}

/** Add work to the active project; the last tick of work finishes it. Returns false when nothing is being researched. */
export function addProgress(sim: Sim, ship: number, work: number): boolean {
  const r = sim.world.get(ship, ResearchC);
  const id = r?.queue[0];
  const def = id ? projectOf(sim, id) : undefined;
  if (!r || !id || !def || !r.paid) return false;
  r.progress += work;
  if (r.progress >= def.work) {
    for (const u of def.unlocks) learn(sim, u);
    r.queue.shift();
    r.progress = 0;
    r.paid = false;
    sim.events.emit({ type: 'research.done', ship, project: id });
  }
  return true;
}

/** The research jobs of a ship's modules, by module id. */
export function researchJobs(sim: Sim): Map<number, number> {
  const out = new Map<number, number>();
  for (const id of sim.world.query(JobC)) {
    const j = sim.world.get(id, JobC);
    if (j?.kind === 'research') out.set(j.target ?? 0, id);
  }
  return out;
}
