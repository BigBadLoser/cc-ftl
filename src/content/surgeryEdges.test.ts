import { describe, expect, it } from 'vitest';
import { CrewC, JobC, type Job } from '../sim/crew/components';
import { ModuleC } from '../sim/modules/components';
import { finishSurgery } from '../sim/crew/surgeryOutcome';
import { lyingIn, operationsOf, surgeryUnderway } from '../sim/crew/surgery';
import { cachedScenario } from '../../test/support/scenario';
import { pickCrew } from './scenario/lib/crewPick';
import { partCondition, partDestroyed } from '../sim/crew/body';
import { addInjury } from '../sim/crew/injure';
import { queueOperation, surgeryHandlers } from '../sim/crew/surgeryHandlers';
import { playerCrew } from '../sim/story/world';
import type { Sim } from '../sim/sim';
import { cachedNewGame } from '../../test/support/content';

const crew = (sim: Sim, n = 0): number => playerCrew(sim).filter((id) => sim.world.has(id, CrewC))[n] as number;

describe('surgery edge cases (#311)', () => {
  it('a spared part takes no injury that would destroy it; without sparing the same injury destroys it', () => {
    const sim = cachedNewGame(3);
    const [a, b] = [crew(sim, 0), crew(sim, 1)];
    for (const id of [a, b]) {
      addInjury(sim, id, 'part.brain', 'injury.concussion');
      addInjury(sim, id, 'part.brain', 'injury.concussion');
    }
    const left = partCondition(sim, a, 'part.brain');
    addInjury(sim, a, 'part.brain', 'injury.surgical', 'spare');
    expect(partDestroyed(sim, a, 'part.brain')).toBe(false);
    expect(partCondition(sim, a, 'part.brain')).toBeCloseTo(left, 6);
    addInjury(sim, b, 'part.brain', 'injury.surgical');
    expect(partDestroyed(sim, b, 'part.brain')).toBe(true);
  });

  it('surgery is underway only while a surgeon holds the begun job', () => {
    const sim = cachedNewGame(3);
    const [patient, surgeon] = [crew(sim, 0), crew(sim, 1)];
    const job: Job = { category: 'medical', kind: 'surgery', x: 0, y: 0, struct: 0, work: 100, progress: 0, reservedBy: surgeon, target: patient, bed: 0, surgery: { op: 1 } };
    sim.world.add(sim.world.createEntity(), JobC, job);
    expect(surgeryUnderway(sim, patient)).toBe(false); // not begun
    job.progress = 10;
    expect(surgeryUnderway(sim, patient)).toBe(true);
    job.reservedBy = 0; // the surgeon was taken off it: the progress stays
    expect(surgeryUnderway(sim, patient)).toBe(false);
  });

  it('an operation queued after the only one is cancelled gets a new id, so the old job cannot pass for it', () => {
    const sim = cachedNewGame(3);
    const id = crew(sim);
    const first = queueOperation(sim, id, { kind: 'amputate', part: 'part.arm_left' });
    surgeryHandlers['crew.cancelOperation'](sim, { type: 'crew.cancelOperation', id, op: first });
    expect(queueOperation(sim, id, { kind: 'amputate', part: 'part.arm_right' })).not.toBe(first);
  });

  it('a finished surgery job does nothing once the patient is out of its bed', () => {
    const sim = cachedScenario('surgery').sim;
    const [patient, medic] = [pickCrew(sim, 0)!, pickCrew(sim, 1)!];
    const bed = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.med_bed') as number;
    expect(lyingIn(sim, patient)).not.toBe(bed);
    const op = queueOperation(sim, patient, { kind: 'fit', part: 'part.eye_right', item: 'item.cyber_eye_2' });
    const job: Job = { category: 'medical', kind: 'surgery', x: 0, y: 0, struct: 0, work: 1, progress: 1, reservedBy: medic, target: patient, bed, surgery: { op } };
    finishSurgery(sim, medic, job);
    expect(operationsOf(sim, patient).map((o) => o.id)).toEqual([op]);
  });
});
