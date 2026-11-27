import { describe, expect, it } from 'vitest';
import type { Sim } from '../sim/sim';
import { cachedNewGame } from '../../test/support/content';
import { CrewC, PositionC } from '../sim/crew/components';
import { drawFromStores } from '../sim/items/stock';
import { shipIdOf } from '../sim/regions';
import type { UiImplantLine } from '../ui/crewDetailApi';
import { cachedScenario } from '../../test/support/scenario';
import { pickCrew } from '../content/scenario/lib/crewPick';
import { buildHealth } from './healthDetail';
import { buildOperations } from './surgeryDetail';
import { suggestedOperation } from '../sim/crew/surgery';

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
    expect(leftEye.lines!.find((l) => l.id === 'item.cyber_eye')!.tiers.find((t) => t.id === 'item.cyber_eye_2')).toMatchObject({ stock: 1, odds: expect.stringMatching(/^success \d+% with a rig, \d+% without$/) });
    expect(ops.picker.ops['part.dermal']!.find((o) => o.kind === 'remove')!.implants).toEqual([expect.objectContaining({ id: 'item.dermal_armor_1', note: 'fitted' })]);
    expect(ops.picker.surgeon).toMatch(/^Best free surgeon: .+ \(Medicine \d+\)$/);
    const h = buildHealth(sim, patient, ops)!;
    expect(h.parts.at(-1)).toMatchObject({ id: 'part.dermal', implant: 'Dermal armour Mk I' });
  });

  it('the fit list has one entry per implant line with its tiers in Mk order, and the best tier in stock is the default', () => {
    const sim = cachedScenario('surgery').sim;
    const patient = pickCrew(sim, 0)!;
    const heart = (): UiImplantLine[] => buildOperations(sim, patient)!.picker.ops['part.heart']!.find((o) => o.kind === 'fit')!.lines!;
    const cyber = heart().find((l) => l.id === 'item.cyber_heart')!;
    expect(cyber.name).toBe('Cyber heart');
    expect(cyber.tiers.map((t) => [t.id, t.tier, t.stock])).toEqual([['item.cyber_heart_1', 1, 1], ['item.cyber_heart_2', 2, 0], ['item.cyber_heart_3', 3, 0]]);
    expect(cyber.best).toBe('item.cyber_heart_1');
    drawFromStores(sim, shipIdOf(sim, sim.world.get(patient, PositionC)), 'item.hawkeye_lens', 1); // the hold is full: make room
    sim.enqueue({ type: 'debug.giveItems', item: 'item.cyber_heart_2', count: 1 });
    sim.applyCommands();
    expect(heart().find((l) => l.id === 'item.cyber_heart')!.best).toBe('item.cyber_heart_2');
    const brain = buildOperations(sim, patient)!.picker.ops['part.brain']!.find((o) => o.kind === 'fit')!.lines!;
    expect(brain.find((l) => l.id === 'item.chip_gunnery')).toMatchObject({ name: 'Neural chip (Gunnery)', best: 'item.chip_gunnery_1' });
    expect(brain.find((l) => l.id === 'item.chip_science')!.best).toBeUndefined(); // listed, greyed: not in stock
  });

  it('named cyberware is its own entry, listed only while the ship has it', () => {
    const stocked = cachedScenario('surgery').sim;
    const patient = pickCrew(stocked, 0)!;
    const named = buildOperations(stocked, patient)!.picker.ops['part.heart']!.find((o) => o.kind === 'fit')!.lines!.find((l) => l.id === 'item.halcyon_heart')!;
    expect(named).toMatchObject({ name: 'Halcyon Heart', named: true, best: 'item.halcyon_heart', tiers: [{ id: 'item.halcyon_heart', tier: null, stock: 1 }] });
    const bare = cachedNewGame(3);
    const crew = bare.world.query(CrewC)[0] as number;
    const lines = buildOperations(bare, crew)!.picker.ops['part.brain']!.find((o) => o.kind === 'fit')!.lines!;
    expect(lines.some((l) => l.named)).toBe(false); // the co-processor is not in stock
    expect(lines.some((l) => l.id === 'item.chip_gunnery')).toBe(true);
  });

  describe('the row action (sim suggestedOperation, #626)', () => {
    const rows = (sim: Sim, id: number) => Object.fromEntries(buildHealth(sim, id, buildOperations(sim, id))!.parts.map((p) => [p.id, p.action]));

    it('a destroyed eye with a replacement in stock is Replace, a lost limb is Amputate, a serious injury is Repair, a minor one only heals', () => {
      const sim = cachedScenario('surgery', { params: { rows: true } }).sim;
      const a = rows(sim, pickCrew(sim, 0)!);
      expect(a['part.eye_right']).toEqual({ kind: 'fit', label: 'Replace' });
      expect(a['part.arm_left']).toEqual({ kind: 'amputate', label: 'Amputate' });
      expect(a['part.lungs']).toEqual({ kind: 'repair', label: 'Repair' });
      expect(a['part.leg_right']).toEqual({ kind: 'heals', label: 'heals' });
      expect(a['part.brain']).toBeUndefined();
    });

    it('an amputated limb is Replace once a cyber limb is in stock, and a lost organ with nothing in stock offers nothing', () => {
      const sim = cachedScenario('surgery', { params: { rows: true } }).sim;
      const id = pickCrew(sim, 0)!;
      sim.enqueue({ type: 'debug.setCrew', id, injuries: [{ part: 'part.heart', kind: 'injury.organ_damage', as: 'destroyed' }] });
      sim.applyCommands();
      expect(rows(sim, id)['part.heart']).toEqual({ kind: 'fit', label: 'Replace' }); // the hold has a heart
      expect(suggestedOperation(sim, id, 'part.lungs')).toBe('repair');
      const bare = cachedNewGame(3);
      const crew = bare.world.query(CrewC)[0] as number;
      bare.enqueue({ type: 'debug.setCrew', id: crew, injuries: [{ part: 'part.eye_right', kind: 'injury.organ_damage', as: 'destroyed' }, { part: 'part.arm_left', kind: 'injury.amputated', as: 'destroyed' }] });
      bare.applyCommands();
      expect(suggestedOperation(bare, crew, 'part.eye_right')).toBeNull(); // no cyber eye aboard
      expect(suggestedOperation(bare, crew, 'part.arm_left')).toBeNull(); // amputated, no cyber arm aboard
    });

    it('the card opens on the best tier in stock for a replacement', () => {
      const sim = cachedScenario('surgery').sim;
      const id = pickCrew(sim, 0)!;
      const eye = buildOperations(sim, id)!.picker.ops['part.eye_right']!.find((o) => o.kind === 'fit')!.lines!.find((l) => l.id === 'item.cyber_eye')!;
      expect(eye.best).toBe('item.cyber_eye_2');
    });
  });
});
