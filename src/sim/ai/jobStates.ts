import { CarriedC, type Job } from '../crew/components';
import { isErrand } from '../eva/errands';
import type { Sim } from '../sim';
import type { MachineId } from './types';

/**
 * The job machines' states (docs/CREW_AI.md section 6). Phase 1 reads them off the legacy components: the per-kind work itself
 * stays in `performJob` (crew/jobWork), the single place it lives, and the machines share navigation (`machines/navigate.ts`).
 *   generic: Navigate, Work            (build, repair, craft, research, operate, mend, salvage, patrol, forceDoor, assemble, hack)
 *   haul:    ToSource, Take, ToDest, Deposit   (the haul's `phase`)
 *   rescue:  ToPatient, Lift, ToBed, Lay       (whether the patient is carried by this crew member)
 *   eva:     ToAirlock, Don | Doff             (suit errands; `Wait` while an idle crew member waits to stow a suit)
 */

/** The machine that carries out a job of this kind. */
export function machineOf(job: Job): MachineId {
  if (job.kind === 'haul') return 'haul';
  if (job.kind === 'rescue') return 'rescue';
  if (isErrand(job)) return 'eva';
  return 'generic';
}

const carrier = (sim: Sim, crew: number, job: Job): boolean => sim.world.get(job.target ?? 0, CarriedC)?.carrier === crew;

/** The state a job machine is in on the way to the site. */
export function travelState(sim: Sim, crew: number, job: Job): string {
  if (job.kind === 'haul') return job.haul?.phase === 'deliver' ? 'ToDest' : 'ToSource';
  if (job.kind === 'rescue') return carrier(sim, crew, job) ? 'ToBed' : 'ToPatient';
  if (isErrand(job)) return 'ToAirlock';
  return 'Navigate';
}

/** The state a job machine is in while working at the site. */
export function workState(sim: Sim, crew: number, job: Job): string {
  if (job.kind === 'haul') return job.haul?.phase === 'deliver' ? 'Deposit' : 'Take';
  if (job.kind === 'rescue') return carrier(sim, crew, job) ? 'Lay' : 'Lift';
  if (job.kind === 'suitUp') return 'Don';
  if (job.kind === 'suitOff') return 'Doff';
  return 'Work';
}
