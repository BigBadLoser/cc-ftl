import { describe, expect, it } from 'vitest';
import { CrewC, JobC, PositionC, RecoveringC, type Job } from '../sim/crew/components';
import { ModuleC } from '../sim/modules/components';
import { bedEnds, rigFitsBed } from '../sim/modules/rig';
import { drawFromStores, shipStoreCount } from '../sim/items/stock';
import { shipIdOf } from '../sim/regions';
import { finishSurgery } from '../sim/crew/surgeryOutcome';
import { lyingIn, operationsOf, surgeryGrade, surgeryUnderway } from '../sim/crew/surgery';
import { cachedScenario } from '../../test/support/scenario';
import { pickCrew } from './scenario/lib/crewPick';
import { injuriesOf, partCondition, partDestroyed } from '../sim/crew/body';
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

  it('a bed with a rig on each side is surgery-grade while either rig works', () => {
    const sim = cachedScenario('surgery').sim;
    const of = (def: string): number => sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def) as number;
    const [bed, rig] = [of('module.med_bed'), of('module.surgery_rig')];
    const b = sim.world.get(bed, ModuleC)!;
    const r = sim.world.get(rig, ModuleC)!;
    const { foot } = bedEnds(sim.content.modules[b.def]!, b.x, b.y, b.rot);
    const other = { ...r, x: 2 * foot.x - r.x, y: 2 * foot.y - r.y, rot: (r.rot + 2) % 4 }; // the far long side, facing the same foot
    expect(rigFitsBed(sim.content.modules[r.def]!, other.x, other.y, other.rot, sim.content.modules[b.def]!, b.x, b.y, b.rot)).toBe(true);
    sim.world.add(sim.world.createEntity(), ModuleC, other);
    r.enabled = false; // the first rig is off; the second still serves the bed
    expect(surgeryGrade(sim, bed)).toBe(true);
    other.enabled = false;
    expect(surgeryGrade(sim, bed)).toBe(false);
  });

  it('with the implant gone from stock, a finished fitting neither succeeds nor wounds: it waits', () => {
    const sim = cachedScenario('surgery').sim;
    const [patient, pilot] = [pickCrew(sim, 0)!, pickCrew(sim, 2)!]; // a poor surgeon: most rolls would fail
    const bed = sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === 'module.med_bed') as number;
    sim.world.add(patient, RecoveringC, { bed });
    const item = 'item.cyber_eye_2';
    const op = queueOperation(sim, patient, { kind: 'fit', part: 'part.eye_right', item });
    const ship = shipIdOf(sim, sim.world.get(patient, PositionC)!);
    drawFromStores(sim, ship, item, shipStoreCount(sim, ship, item));
    expect(shipStoreCount(sim, ship, item)).toBe(0);
    const before = injuriesOf(sim, patient).filter((i) => i.part === 'part.eye_right'); // the scenario's lost eye
    for (let n = 0; n < 20; n++) finishSurgery(sim, pilot, { category: 'medical', kind: 'surgery', x: 0, y: 0, struct: 0, work: 1, progress: 1, reservedBy: pilot, target: patient, bed, surgery: { op } });
    expect(operationsOf(sim, patient).map((o) => o.id)).toEqual([op]);
    expect(injuriesOf(sim, patient).filter((i) => i.part === 'part.eye_right')).toEqual(before);
  });
});
