import type { Sim } from '../sim';
import { WorkBlockC, type WorkCategory } from './components';

/** The `why` of a permanent won't-do block (docs/TRAITS.md 10.10). */
export const WONT_DO_WHY = 'wontDo';

/** Block a work category for the crew member, for a reason (one entry per category and reason). */
export function blockWork(sim: Sim, crew: number, category: WorkCategory, why: string): void {
  if (!sim.world.isAlive(crew)) return;
  const b = sim.world.get(crew, WorkBlockC) ?? (sim.world.add(crew, WorkBlockC, { blocked: [] }), sim.world.get(crew, WorkBlockC)!);
  if (!b.blocked.some((x) => x.category === category && x.why === why)) b.blocked.push({ category, why });
}

/** Lift the blocks a reason put on the crew member (only that category, when given); the component goes with the last one. */
export function unblockWork(sim: Sim, crew: number, why: string, category?: WorkCategory): void {
  const b = sim.world.get(crew, WorkBlockC);
  if (!b) return;
  b.blocked = b.blocked.filter((x) => x.why !== why || (category !== undefined && x.category !== category));
  if (!b.blocked.length) sim.world.remove(crew, WorkBlockC);
}

/** Why the crew member cannot do this work category (the first reason), or undefined when they can. */
export function workBlocked(sim: Sim, crew: number, category: WorkCategory): string | undefined {
  return sim.world.get(crew, WorkBlockC)?.blocked.find((x) => x.category === category)?.why;
}
