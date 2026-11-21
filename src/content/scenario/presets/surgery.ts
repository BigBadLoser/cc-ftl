import { pickCrew } from '../lib/crewPick';
import { definePreset, flag } from '../types';

/**
 * `?scenario=surgery` (#311): surgery and implants. A surgery table and a medical bed are added and implants put in the hold (cyber eyes and arms, a neural chip, a cyber
 * heart). The gunner has lost the right eye and the left arm, and carries a Mk I dermal armour already; the medic operates. Queue operations from the
 * gunner's Health tab (selected). `&queue`: an eye replacement and an amputation are queued at once, so the gunner walks to the table.
 */
export default definePreset({
  doc: 'Surgery: a surgery table, a medic, implants in stock, and a gunner with a lost eye and a destroyed arm.',
  params: { queue: flag() },
  spec: (p) => ({
    node: { warm: 10 },
    modules: { add: [{ def: 'module.surgery_table' }, { def: 'module.med_bed' }] },
    items: { give: { 'item.cyber_eye_1': 1, 'item.cyber_eye_2': 1, 'item.cyber_arm_1': 1, 'item.cyber_arm_2': 1, 'item.chip_gunnery_1': 1, 'item.cyber_heart_1': 1 } },
    crew: [
      {
        who: 'role.gunner',
        set: {
          injuries: [{ part: 'part.eye_right', kind: 'injury.organ_damage', as: 'destroyed' }, { part: 'part.arm_left', kind: 'injury.fracture', as: 'destroyed' }],
          implants: [{ part: 'part.dermal', item: 'item.dermal_armor_1' }],
        },
      },
    ],
    ...(p['queue'] ? {
      steps: [{
        cmds: (ctx: { sim: Parameters<typeof pickCrew>[0] }) => {
          const id = pickCrew(ctx.sim, 'role.gunner') ?? 0;
          return [
            { type: 'crew.queueOperation' as const, id, kind: 'fit' as const, part: 'part.eye_right', item: 'item.cyber_eye_2' },
            { type: 'crew.queueOperation' as const, id, kind: 'amputate' as const, part: 'part.arm_left' },
          ];
        },
        ticks: 1,
      }],
    } : {}),
    ui: { speed: 1, select: (sim) => pickCrew(sim, 'role.gunner') },
  }),
});
