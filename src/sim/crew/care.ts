import { factionsHostile } from '../combat/factions';
import { AllegianceC, PrisonerC, SurrenderedC } from '../fight/components';
import type { Sim } from '../sim';
import { DownedC, RecoveringC } from './components';

/**
 * How far our crew's care reaches: `normal` for our own, allied and neutral crew, `low` for a surrendered or captured one (they are
 * rescued and tended after our own people), `never` for an enemy who is still fighting (downed, but not surrendered or a prisoner).
 */
export type CareRank = 'normal' | 'low' | 'never';

/**
 * The one answer to "may our crew rescue or tend this person, and at what rank": the rescue jobs (systems/autojobs.ts), the tend jobs
 * (`bedsToTend`) and the scheduler's urgency (ai/jobRank.ts) all ask it.
 */
export function careRank(sim: Sim, patient: number): CareRank {
  if (sim.world.has(patient, PrisonerC) || sim.world.has(patient, SurrenderedC)) return 'low';
  return factionsHostile(sim.world.get(patient, AllegianceC)?.faction, 'player') ? 'never' : 'normal';
}

/** The care rank of the medical bed `bed`'s patients (the best of them; `normal` when it is empty): the tend job's rank. */
export function bedCareRank(sim: Sim, bed: number): CareRank {
  const ranks: CareRank[] = [];
  for (const id of sim.world.query(DownedC)) if (sim.world.get(id, DownedC)?.bed === bed) ranks.push(careRank(sim, id));
  for (const id of sim.world.query(RecoveringC)) if (sim.world.get(id, RecoveringC)?.bed === bed) ranks.push(careRank(sim, id));
  return ranks.includes('normal') || !ranks.length ? 'normal' : ranks.includes('low') ? 'low' : 'never';
}
