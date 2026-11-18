import { CrewC } from '../../../sim';
import { medpodCommands, spareBedCommands } from '../lib/medpod';
import { definePreset, flag, str } from '../types';

/**
 * `?scenario=medpod[&signal][&guest][&role=<role id>]` (#173 step 6): the medical pod. A spare bed is set, then the pod beacon signals on the first hop of a
 * trip and the ship drops out beside the pod (`&signal`: stop at the signal, to scan it). `&guest` instead puts a passenger aboard at once (a lodging guest,
 * consent/passage.ts) and selects them. `&passage`: that passenger is the pod's patient, on their feet: they pay and post a passage card (galaxy/passage.ts);
 * `&deliver` also accepts it and puts the ship at the destination, where they ask to join before the handover (made cheerful, so in the mood to: the
 * `medpod.deliver` scenario hook).
 */
export default definePreset({
  doc: 'The medical pod: its signal, or a passenger aboard.',
  params: { signal: flag(), guest: flag(), passage: flag(), deliver: flag(), role: str() },
  spec: (p) => {
    const guest = !!p['guest'] || !!p['passage'];
    const role = typeof p['role'] === 'string' ? p['role'] : undefined;
    return {
      node: { warm: 12 },
      ...(guest
        ? {
          steps: [{ cmds: (ctx: { sim: Parameters<typeof medpodCommands>[0] }) => medpodCommands(ctx.sim, role, !!p['passage']), ticks: 8 }],
          hooks: p['deliver'] ? [{ name: 'medpod.deliver' }] : [],
          ui: { speed: 1, select: p['deliver'] ? undefined : (sim: Parameters<typeof medpodCommands>[0]) => sim.world.query(CrewC).at(-1) },
        }
        : {
          items: { give: { 'item.fuel': 80 } },
          prep: [{ cmds: (ctx: { sim: Parameters<typeof medpodCommands>[0] }) => spareBedCommands(ctx.sim) }],
          events: { queue: 'event.medical_emergency', trip: { hops: 2 }, ...(p['signal'] ? {} : { choose: ['approach'] }) },
          ui: { speed: 1 },
        }),
    };
  },
});
