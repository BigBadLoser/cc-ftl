import { describe, expect, it } from 'vitest';
import { CrewC, DeadC, DownedC, PositionC, RecoveringC } from '../sim/crew/components';
import { capacitiesOf, injuriesOf, partDestroyed, vitalLost } from '../sim/crew/body';
import { addInjury } from '../sim/crew/injure';
import { implantLoad, implantOn, implantsOf } from '../sim/crew/implants';
import { finishSurgery, fitImplant } from '../sim/crew/surgeryOutcome';
import { bedUseOf } from '../sim/crew/beds';
import { operationError, operationsOf, surgeryChance, surgeryGrade, theatreFits } from '../sim/crew/surgery';
import { augmentedCrew } from '../sim/trade/augmentation';
import { shipStoreCount } from '../sim/items/stock';
import { ModuleC } from '../sim/modules/components';
import { bedOfRig, rigFitsBed } from '../sim/modules/rig';
import { placementError } from '../sim/modules/spawn';
import { shipGrid, shipIdOf } from '../sim/regions';
import { stat } from '../sim/stats';
import { playerCrew } from '../sim/story/world';
import type { Sim } from '../sim/sim';
import { TICK_HZ } from '../sim/time';
import { play } from './scenario';
import { cachedNewGame } from '../../test/support/content';
import { cachedScenario } from '../../test/support/scenario';
import { eventsOf } from '../../test/support/sim';
import { expectReplayable } from '../../test/support/world';
import { pickCrew } from './scenario/lib/crewPick';

const human = (sim: Sim, n = 0): number => playerCrew(sim).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human')[n] as number;
/** The player's first module of `def` (the scenario adds a medical bed and a surgical rig facing its foot). */
const moduleOf = (sim: Sim, def: string): number => {
  const home = shipIdOf(sim, sim.world.get(playerCrew(sim)[0] as number, PositionC));
  return sim.world.query(ModuleC).find((id) => sim.world.get(id, ModuleC)?.def === def && shipIdOf(sim, sim.world.get(id, ModuleC)) === home) as number;
};
const ship = (sim: Sim): number => shipIdOf(sim, sim.world.get(moduleOf(sim, 'module.med_bed'), ModuleC));

describe('surgery and implants (#311)', () => {
  it('fitting an implant changes the capacity and the stats, under the implant origin', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    const melee = stat(sim, id, 'melee');
    const gunnery = stat(sim, id, 'gunnery');
    fitImplant(sim, id, 'part.arm_right', 'item.cyber_arm_3'); // capacity 1.2, melee +2
    expect(capacitiesOf(sim, id).manipulation).toBeCloseTo(1.1, 6); // one arm of two
    expect(stat(sim, id, 'melee')).toBeGreaterThan(melee + 2);
    fitImplant(sim, id, 'part.brain', 'item.chip_gunnery_1');
    expect(stat(sim, id, 'gunnery')).toBeCloseTo(gunnery + 1, 6);
    fitImplant(sim, id, 'part.eye_left', 'item.cyber_eye_1'); // a crude eye: sight under flesh, aim a little worse than the chip alone
    expect(capacitiesOf(sim, id).sight).toBeLessThan(1);
    expect(stat(sim, id, 'gunnery')).toBeLessThan(gunnery + 1);
    expect(implantLoad(sim, id)).toBe(5);
  });

  it('a replacement restores a destroyed part, and takes no injuries itself', () => {
    const sim = cachedNewGame(3);
    const id = human(sim);
    addInjury(sim, id, 'part.eye_right', 'injury.organ_damage', 'destroyed');
    expect(capacitiesOf(sim, id).sight).toBeLessThan(0.6);
    fitImplant(sim, id, 'part.eye_right', 'item.cyber_eye_2');
    expect(partDestroyed(sim, id, 'part.eye_right')).toBe(false);
    expect(capacitiesOf(sim, id).sight).toBeCloseTo(1, 6);
    addInjury(sim, id, 'part.eye_right', 'injury.cut');
    expect(injuriesOf(sim, id).filter((i) => i.part === 'part.eye_right')).toHaveLength(0);
    // A lost limb must be amputated before a cyber limb goes on.
    addInjury(sim, id, 'part.arm_left', 'injury.fracture', 'destroyed');
    expect(operationError(sim, id, { kind: 'fit', part: 'part.arm_left', item: 'item.cyber_arm_1' })).toBe('amputateFirst');
    expect(operationError(sim, id, { kind: 'amputate', part: 'part.arm_left' })).toBeNull();
    expect(operationError(sim, id, { kind: 'remove', part: 'part.heart', item: 'item.cyber_heart_1' })).toBe('noImplant');
  });

  it('a medical bed with a rig beats one without, and brain and spine work needs the rig', () => {
    const built = cachedScenario('surgery');
    const sim = built.sim;
    const patient = pickCrew(sim, 0)!;
    const medic = pickCrew(sim, 1)!;
    const op = { kind: 'fit' as const, part: 'part.eye_right', item: 'item.cyber_eye_2' };
    expect(surgeryChance(sim, medic, patient, op, 'rig')).toBeGreaterThan(surgeryChance(sim, medic, patient, op, 'bed'));
    const rig = moduleOf(sim, 'module.surgery_rig');
    const bed = moduleOf(sim, 'module.med_bed');
    expect(built.rejected).toEqual({});
    expect(bedOfRig(sim.world, sim.content.modules, shipGrid(sim, ship(sim))!, rig)).toBe(bed);
    expect(surgeryGrade(sim, bed)).toBe(true);
    expect(theatreFits(sim, bed, { part: 'part.brain' })).toBe(true);
    // Switched off, the rig serves nothing: the bed is a plain medical bed again.
    sim.enqueue({ type: 'module.setEnabled', id: rig, enabled: false });
    play(built, 1);
    expect(surgeryGrade(sim, bed)).toBe(false);
    expect(theatreFits(sim, bed, { part: 'part.eye_right' })).toBe(true);
    expect(theatreFits(sim, bed, { part: 'part.brain' })).toBe(false);
    expect(theatreFits(sim, bed, { part: 'part.spine' })).toBe(false);
    sim.enqueue({ type: 'module.setEnabled', id: rig, enabled: true });
    sim.enqueue({ type: 'crew.queueOperation', id: patient, kind: 'fit', part: 'part.brain', item: 'item.chip_gunnery_1' });
    play(built, 1);
    expect(bedUseOf(sim, patient)).toBe('surgeryRig'); // the walk goes to a rigged bed, never a plain one
  });

  it('a rig stands only beside the foot of a medical bed, facing it from a long side', () => {
    const sim = cachedScenario('surgery').sim;
    const home = ship(sim);
    const b = sim.world.get(moduleOf(sim, 'module.med_bed'), ModuleC)!;
    const [rigDef, bedDef] = [sim.content.modules['module.surgery_rig']!, sim.content.modules['module.med_bed']!];
    const errors: (string | null)[] = [];
    for (let y = b.y - 2; y <= b.y + 3; y++) for (let x = b.x - 2; x <= b.x + 3; x++) for (let rot = 0; rot < 4; rot++) {
      const err = placementError(sim, home, 'module.surgery_rig', x, y, rot);
      errors.push(err);
      if (!rigFitsBed(rigDef, x, y, rot, bedDef, b.x, b.y, b.rot)) expect(err, `${x},${y} r${rot}`).not.toBeNull();
      else expect(err).not.toBe('rigNeedsBedFoot');
    }
    expect(errors).toContain('rigNeedsBedFoot');
  });

  it('a queued replacement: the patient walks to the rigged bed, the medic operates, and the outcome replays from the seed and a save', () => {
    const built = cachedScenario('surgery', { params: { queue: true } });
    const sim = built.sim;
    const patient = pickCrew(sim, 0)!;
    const before = shipStoreCount(sim, ship(sim), 'item.cyber_eye_2');
    const events = play(built, 300 * TICK_HZ, { until: (s) => !operationsOf(s, patient).some((o) => o.part === 'part.eye_right') });
    const done = eventsOf(events, 'crew.surgery').find((e) => e.crew === patient && e.part === 'part.eye_right');
    expect(done?.by).toBeTruthy();
    expect(done?.by).not.toBe(patient);
    expect(done?.outcome).toBe('success'); // this seed's roll
    expect(implantOn(sim, patient, 'part.eye_right', 'replacement')?.item).toBe('item.cyber_eye_2');
    expect(shipStoreCount(sim, ship(sim), 'item.cyber_eye_2')).toBe(before - 1);
    expect(capacitiesOf(sim, patient).sight).toBeCloseTo(1, 6); // the Mk II eye is as good as flesh
    const build = (): Sim => cachedScenario('surgery', { params: { queue: true } }).sim;
    expectReplayable(build, 1500, { saveAt: 900 }); // past the roll (about tick 1250)
  });

  it('a poor surgeon at a bed fails and botches some operations, and the same seed rolls the same outcomes', () => {
    const rolls = (): string[] => {
      const sim = cachedScenario('surgery').sim;
      const patient = pickCrew(sim, 0)!;
      const pilot = pickCrew(sim, 2)!;
      const bed = moduleOf(sim, 'module.med_bed');
      sim.world.add(patient, RecoveringC, { bed }); // the patient lies in the rigged bed, as the job needs at its end
      const out: string[] = [];
      for (let n = 0; n < 40; n++) {
        if (!implantsOf(sim, patient).length) fitImplant(sim, patient, DERMAL, 'item.dermal_armor_1');
        sim.enqueue({ type: 'crew.queueOperation', id: patient, kind: 'remove', part: DERMAL, item: 'item.dermal_armor_1' });
        sim.applyCommands();
        const op = operationsOf(sim, patient)[0]!;
        finishSurgery(sim, pilot, { category: 'medical', kind: 'surgery', x: 0, y: 0, struct: 0, work: 1, progress: 1, reservedBy: pilot, target: patient, bed, surgery: { op: op.id } });
        out.push(...eventsOf(sim.events.drain(), 'crew.surgery').map((e) => e.outcome));
      }
      return out;
    };
    const a = rolls();
    expect(a).toHaveLength(40);
    expect(a).toEqual(rolls());
    for (const o of ['success', 'failure', 'botched']) expect(a, o).toContain(o);
  });

  it('removing an implant returns its item to storage', () => {
    const built = cachedScenario('surgery');
    const sim = built.sim;
    const patient = pickCrew(sim, 0)!;
    const before = shipStoreCount(sim, ship(sim), 'item.dermal_armor_1');
    let removed = false;
    for (let n = 0; n < 5 && !removed; n++) { // a failed removal leaves it in: try again
      sim.enqueue({ type: 'crew.queueOperation', id: patient, kind: 'remove', part: 'part.dermal', item: 'item.dermal_armor_1' });
      const events = play(built, 300 * TICK_HZ, { until: (s) => !operationsOf(s, patient).length });
      removed = eventsOf(events, 'crew.surgery').some((e) => e.crew === patient && e.outcome === 'success');
    }
    expect(removed).toBe(true);
    expect(implantsOf(sim, patient)).toHaveLength(0);
    expect(shipStoreCount(sim, ship(sim), 'item.dermal_armor_1')).toBe(before + 1);
  });

  it('a downed crew member with a lost heart is saved by an urgent replacement from stock', () => {
    const built = cachedScenario('surgery');
    const sim = built.sim;
    const pilot = pickCrew(sim, 2)!;
    sim.enqueue({ type: 'debug.setCrew', id: pilot, injuries: [{ part: 'part.heart', kind: 'injury.organ_damage', as: 'destroyed' }] });
    play(built, 20);
    expect(sim.world.has(pilot, DownedC)).toBe(true);
    expect(operationsOf(sim, pilot)[0]).toMatchObject({ kind: 'fit', part: 'part.heart', item: 'item.cyber_heart_1', urgent: true });
    play(built, 120 * TICK_HZ, { until: (s) => !vitalLost(s, pilot) || s.world.has(pilot, DeadC) });
    expect(sim.world.has(pilot, DeadC)).toBe(false);
    expect(implantOn(sim, pilot, 'part.heart', 'replacement')?.item).toBe('item.cyber_heart_1');
  });

  it('augmentedCrew counts crew at implant load 6 or more', () => {
    const sim = cachedNewGame(3);
    const [a, b] = [human(sim, 0), human(sim, 1)];
    expect(augmentedCrew(sim)).toBe(0);
    fitImplant(sim, a, 'part.arm_right', 'item.cyber_arm_3');
    fitImplant(sim, a, 'part.leg_right', 'item.cyber_leg_2');
    expect(augmentedCrew(sim)).toBe(0); // load 5
    fitImplant(sim, a, DERMAL, 'item.dermal_armor_1');
    fitImplant(sim, b, 'part.brain', 'item.chip_gunnery_1');
    expect(augmentedCrew(sim)).toBe(1);
  });
});

const DERMAL = 'part.dermal';
