import type { Command, Sim } from '../../../sim';
import { pickCrew } from '../lib/crewPick';
import { definePreset, flag } from '../types';

/**
 * `?scenario=surgery` (#311): surgery and implants. A surgery table and a medical bed are added and implants put in the hold (cyber eyes and arms, a neural
 * chip, a cyber heart). The first crew member (the patient, selected) has lost the right eye and the left arm, and carries a Mk I dermal armour already;
 * the second is made a surgeon (Medicine +6, medical work first). Queue operations from the patient's Health tab. `&queue`: an eye replacement and an
 * amputation are queued at once, so the patient walks to the table. Works on any starter crew (the app rolls them).
 */
export default definePreset({
  doc: 'Surgery: a surgery table, a surgeon, implants in stock, and a patient with a lost eye and a destroyed arm.',
  params: { queue: flag() },
  spec: (p) => ({
    node: { warm: 10 },
    modules: { add: [{ def: 'module.surgery_table' }, { def: 'module.med_bed' }] },
    items: { give: { 'item.cyber_eye_1': 1, 'item.cyber_eye_2': 1, 'item.cyber_arm_1': 1, 'item.cyber_arm_2': 1, 'item.chip_gunnery_1': 1, 'item.cyber_heart_1': 1 } },
    crew: [
      {
        who: 0,
        set: {
          injuries: [{ part: 'part.eye_right', kind: 'injury.organ_damage', as: 'destroyed' }, { part: 'part.arm_left', kind: 'injury.fracture', as: 'destroyed' }],
          implants: [{ part: 'part.dermal', item: 'item.dermal_armor_1' }],
        },
      },
      { who: 1, set: { xp: { medicine: 1820 } } },
    ],
    steps: [{
      cmds: (ctx: { sim: Sim }): Command[] => {
        const patient = pickCrew(ctx.sim, 0) ?? 0;
        const surgeon: Command = { type: 'crew.setPriority', id: pickCrew(ctx.sim, 1) ?? 0, category: 'medical', value: 1 };
        if (!p['queue']) return [surgeon];
        return [
          surgeon,
          { type: 'crew.queueOperation', id: patient, kind: 'fit', part: 'part.eye_right', item: 'item.cyber_eye_2' },
          { type: 'crew.queueOperation', id: patient, kind: 'amputate', part: 'part.arm_left' },
        ];
      },
      ticks: 1,
    }],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 0) },
  }),
});
