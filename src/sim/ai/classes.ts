import type { Job } from '../crew/components';
import type { MachineId, TaskClass } from './types';

/**
 * Interruption class per (machine, state) (docs/CREW_AI.md section 5). Copied to `Task.class`. Phase 1 only records it: the
 * legacy code still decides when a task is dropped.
 */
const CLASSES: Record<MachineId, Record<string, TaskClass>> = {
  generic: { Navigate: 'any', Work: 'any' },
  haul: { ToSource: 'any', Take: 'any', ToDest: 'safe', Deposit: 'safe' },
  rescue: { ToPatient: 'any', Lift: 'any', ToBed: 'finish', Lay: 'finish' },
  eva: { Wait: 'any', ToAirlock: 'any', Don: 'safe', Doff: 'safe', Fill: 'finish' },
  eat: { Walk: 'any', Consume: 'safe' },
  sleep: { ClaimBed: 'any', Walk: 'any', Sleep: 'any' },
  charge: { Walk: 'any', Charge: 'any' },
  escape: { Walk: 'any' },
  leisure: { Walk: 'any', Relax: 'any' },
  return: { Walk: 'any' },
  // A break holds the crew member until it ends: only a hard reason (hazard, down, a severe break over a moderate one) takes them off.
  break: { Flee: 'hold', Cower: 'hold', Freeze: 'hold', Hide: 'hold', Sulk: 'hold', Walk: 'hold', Lie: 'hold' },
};

/** Every (machine, state) pair the executor uses, for tests that must cover each one. */
export function machineStates(): [MachineId, string][] {
  return (Object.entries(CLASSES) as [MachineId, Record<string, TaskClass>][]).flatMap(([m, states]) => Object.keys(states).map((s) => [m, s] as [MachineId, string]));
}

/** The class of a state; a console held by an operator is `hold`. */
export function classOf(machine: MachineId, state: string, job?: Job): TaskClass {
  if (machine === 'generic' && job?.kind === 'operate') return 'hold';
  return CLASSES[machine][state] ?? 'any';
}
