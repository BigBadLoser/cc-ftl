import { ModuleC, placementError, playerShip, type Command, type Sim } from '../../../sim';
import { pickCrew } from '../lib/crewPick';
import { definePreset, flag } from '../types';

const RIG = 'module.surgery_rig';

/** A surgical rig beside the medical bed, facing its foot from whichever side is free (the placement rule picks the spot). */
function rigBeside(sim: Sim): Command[] {
  const ship = playerShip(sim);
  const bed = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)!).find((m) => m.def === 'module.med_bed');
  if (!ship || !bed) return [];
  for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) for (let rot = 0; rot < 4; rot++) {
    const x = bed.x + dx, y = bed.y + dy;
    if (placementError(sim, ship, RIG, x, y, rot) === null) return [{ type: 'debug.spawnModule', ship, x, y, def: RIG, rot }];
  }
  return [];
}

/**
 * `?scenario=surgery` (#311): surgery and implants. A medical bed with a surgical rig beside it is added and implants put in the hold (cyber eyes and arms, a neural
 * chip, a cyber heart, the named Halcyon Heart). The first crew member (the patient, selected) has lost the right eye and the left arm, and carries a Mk I dermal armour already;
 * the second is made a surgeon (Medicine +6, medical work first). Queue operations from the patient's Health tab. `&rows`: lungs with a serious injury and a bruised leg, to show every Health row action. `&queue`: an eye replacement and an
 * amputation are queued at once, so the patient walks to the rigged bed. Works on any starter crew (the app rolls them).
 */
export default definePreset({
  doc: 'Surgery: a medical bed with a surgical rig, a surgeon, implants in stock, and a patient with a lost eye and a destroyed arm.',
  params: { queue: flag(), rows: flag() },
  spec: (p) => ({
    node: { warm: 10 },
    modules: { add: [{ def: 'module.med_bed' }] },
    items: { give: { 'item.cyber_eye_1': 1, 'item.cyber_eye_2': 1, 'item.cyber_arm_1': 1, 'item.cyber_arm_2': 1, 'item.chip_gunnery_1': 1, 'item.cyber_heart_1': 1, 'item.halcyon_heart': 1, 'item.hawkeye_lens': 1 } },
    crew: [
      {
        who: 0,
        set: {
          injuries: [...(p.rows ? [{ part: 'part.lungs', kind: 'injury.organ_damage' }, { part: 'part.leg_right', kind: 'injury.bruise' }] : []), { part: 'part.eye_right', kind: 'injury.organ_damage', as: 'destroyed' }, { part: 'part.arm_left', kind: 'injury.fracture', as: 'destroyed' }],
          implants: [{ part: 'part.dermal', item: 'item.dermal_armor_1' }],
        },
      },
      { who: 1, set: { xp: { medicine: 1820 } } },
    ],
    steps: [{ cmds: (ctx: { sim: Sim }) => rigBeside(ctx.sim), ticks: 1 }, {
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
