import { describe, expect, it } from 'vitest';
import { cachedScenario } from '../../test/support/scenario';
import { pickCrew } from '../content/scenario/lib/crewPick';
import { buildHealth } from './healthDetail';
import { buildOperations } from './surgeryDetail';

describe('the Health tab surgery section (#311)', () => {
  it('fills the queue and the picker from the sim: real stock, greyed reasons, odds, and implants on their rows', () => {
    const sim = cachedScenario('surgery').sim;
    const patient = pickCrew(sim, 0)!;
    sim.enqueue({ type: 'crew.queueOperation', id: patient, kind: 'fit', part: 'part.eye_right', item: 'item.cyber_eye_1' });
    sim.applyCommands();
    const ops = buildOperations(sim, patient)!;
    expect(ops.live).toBe(true);
    expect(ops.queue).toEqual([expect.objectContaining({ label: 'Fit Cyber eye Mk I', icon: 'part-eye' })]);
    const eye = ops.picker.ops['part.eye_right']!;
    expect(eye.find((o) => o.kind === 'fit')!.disabled).toBe('already queued');
    expect(eye.find((o) => o.kind === 'repair')!.disabled).toBe('a lost right eye can only be replaced');
    const arm = ops.picker.ops['part.arm_left']!;
    expect(arm.find((o) => o.kind === 'fit')!.disabled).toBe('amputate the lost left arm first');
    expect(arm.find((o) => o.kind === 'amputate')!.disabled).toBeUndefined();
    const leftEye = ops.picker.ops['part.eye_left']!.find((o) => o.kind === 'fit')!;
    expect(leftEye.implants!.find((i) => i.id === 'item.cyber_eye_2')).toMatchObject({ stock: 1, odds: expect.stringMatching(/^success \d+% with a rig, \d+% without$/) });
    expect(ops.picker.ops['part.dermal']!.find((o) => o.kind === 'remove')!.implants).toEqual([expect.objectContaining({ id: 'item.dermal_armor_1', note: 'fitted' })]);
    expect(ops.picker.surgeon).toMatch(/^Best free surgeon: .+ \(Medicine \d+\)$/);
    const h = buildHealth(sim, patient, ops)!;
    expect(h.parts.at(-1)).toMatchObject({ id: 'part.dermal', implant: 'Dermal armour Mk I' });
  });
});
