import { factionsHostile } from '../combat/factions';
import type { Faction } from '../combat/components';
import { AllegianceC, PrisonerC, SurrenderedC } from '../fight/components';
import type { Sim } from '../sim';
import { DownedC, RecoveringC, type Job } from './components';

/**
 * How far a caregiver's side reaches for a patient: `normal` for their own, allied and neutral crew, `low` for a surrendered or captured enemy (rescued and
 * tended after their own people), `never` for an enemy who is still fighting (downed, but not surrendered or a prisoner). The same rule for every side:
 * the player's medics, and an enemy ship's own crew tending theirs.
 */
export type CareRank = 'normal' | 'low' | 'never';

/** The side a crew member fights for (undefined for an entity without an allegiance: it is at war with nobody). */
export const sideOf = (sim: Sim, crew: number): Faction | undefined => sim.world.get(crew, AllegianceC)?.faction;

/**
 * The one answer to "may a caregiver of side `side` rescue or tend this person, and at what rank": the job picks (`jobCareFits`, from `jobFits`), the
 * hidden-rescue claim and the scheduler's urgency (ai/jobRank.ts, which ranks as the player's side sees it) all ask it.
 */
export function careRank(sim: Sim, side: Faction | undefined, patient: number): CareRank {
  if (!factionsHostile(sim.world.get(patient, AllegianceC)?.faction, side)) return 'normal';
  return sim.world.has(patient, PrisonerC) || sim.world.has(patient, SurrenderedC) ? 'low' : 'never';
}

/** The care rank of the medical bed `bed`'s patients for `side` (the best of them; `normal` when it is empty): the tend job's rank. */
export function bedCareRank(sim: Sim, side: Faction | undefined, bed: number): CareRank {
  const ranks: CareRank[] = [];
  for (const id of sim.world.query(DownedC)) if (sim.world.get(id, DownedC)?.bed === bed) ranks.push(careRank(sim, side, id));
  for (const id of sim.world.query(RecoveringC)) if (sim.world.get(id, RecoveringC)?.bed === bed) ranks.push(careRank(sim, side, id));
  return ranks.includes('normal') || !ranks.length ? 'normal' : ranks.includes('low') ? 'low' : 'never';
}

/** Whether `crew`'s side may take this job at all, as far as care goes: a rescue or tend job is never theirs for a still-fighting enemy. Other jobs: true. */
export function jobCareFits(sim: Sim, crew: number, job: Job): boolean {
  if (job.kind === 'rescue') return careRank(sim, sideOf(sim, crew), job.target ?? 0) !== 'never';
  if (job.kind === 'tend') return bedCareRank(sim, sideOf(sim, crew), job.target ?? 0) !== 'never';
  return true;
}
