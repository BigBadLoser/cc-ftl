import type { Sim } from '../../../sim';
import { definePreset, flag, num, oneOf } from '../types';

/**
 * `?scenario=freighter[&signal][&help][&raiders=none|here|coming]` (#173, the distress freighter): the same start as the ambush, for `event.distress_call`.
 * `&raiders=` fixes its raiders (default none at the start), `&help` hails it and offers help before dropping out (the party goes aboard once deployed),
 * `&signal` stops at the signal window. Built on to the scene with the reactor clock started (the clock starts at deploy: the next scene second).
 */
export default definePreset({
  doc: 'The distress freighter: a helpless ship, aid by hail, the reactor clock, raiders.',
  params: { signal: flag(), help: flag(), raiders: oneOf('none', 'here', 'coming'), warm: num() },
  spec: (p) => {
    const warm = typeof p['warm'] === 'number' ? p['warm'] : 10;
    const timersStarted = (sim: Sim): boolean => !sim.galaxy.event?.scene.timers.some((t) => t.at === undefined);
    return {
      ship: { skipGoals: true, clearFleets: true },
      ...(warm ? { node: { warm } } : {}),
      items: { give: { 'item.fuel': 80 } },
      events: {
        queue: 'event.distress_call',
        trip: { hops: 2 },
        raiders: (p['raiders'] as 'none' | 'here' | 'coming' | undefined) ?? 'none',
        ...(p['signal'] ? {} : { choose: p['help'] ? ['hail', 'help'] : ['approach'] }),
      },
      ...(p['signal'] ? {} : { steps: [{ until: timersStarted, max: 200, what: 'the reactor clock starts' }] }),
      ui: { speed: 1 },
    };
  },
});
