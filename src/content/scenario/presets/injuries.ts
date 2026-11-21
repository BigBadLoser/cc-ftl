import { pickCrew } from '../lib/crewPick';
import { definePreset } from '../types';

/**
 * `?scenario=injuries` (#601): crew injuries. A medical bed is added. The first gunner (else the first crew member) has a fracture waiting for treatment,
 * a lost eye, an old scar and a bleeding cut; the next crew member a bleeding puncture. Medics come for first aid, then the gunner walks to the bed to be
 * treated. The gunner is selected, so the inspector's Status tab shows the injury list.
 */
export default definePreset({
  doc: 'Injured crew: a fracture to treat, a lost eye, a scar and bleeding wounds for first aid.',
  spec: () => ({
    node: { warm: 10 },
    modules: { add: [{ def: 'module.med_bed' }] },
    crew: [
      {
        who: 'role.gunner',
        set: {
          hp: 70,
          injuries: [
            { part: 'part.leg_left', kind: 'injury.fracture' }, { part: 'part.eye_right', kind: 'injury.organ_damage', as: 'destroyed' },
            { part: 'part.arm_right', kind: 'injury.deep_burn', as: 'scar' }, { part: 'part.arm_left', kind: 'injury.cut' },
          ],
        },
      },
      { who: 1, set: { injuries: [{ part: 'part.lungs', kind: 'injury.puncture' }] } },
    ],
    ui: { speed: 1, select: (sim) => pickCrew(sim, 'role.gunner') },
  }),
});
