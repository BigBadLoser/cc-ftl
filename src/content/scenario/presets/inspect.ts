import { InspectionC } from '../../../sim/inspect/types';
import { inspectCommands, inspectStation } from '../lib/inspect';
import { definePreset, flag, oneOf } from '../types';

/**
 * `?scenario=inspect[&clean][&eva][&fight][&select]` (#138 step 1; `&fight` and `&select` step 3): a contraband inspection at a station. A navy-run trading
 * outpost beside the ship, stolen goods in the hold (`&clean`: none), and the station hailed: its inspectors come over by shuttle, search the holds, carry
 * the goods off and wait for an answer (the alert). `&eva`: the ship's airlocks are switched off, so they cross in suits and wait on the hull until one
 * is switched back on. `&stage=search` (tests): built until the inspectors are aboard and searching.
 */
export default definePreset({
  doc: 'A navy station hails the contraband ship: inspectors come over and search.',
  params: { clean: flag(), eva: flag(), fight: flag(), select: flag(), stage: oneOf('hailed', 'search') },
  spec: (p) => ({
    ship: { seed: 3 },
    node: { warm: 20, stations: [{ kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy', frame: true }] },
    steps: [
      { cmds: (ctx) => inspectCommands(ctx.sim, inspectStation(ctx.sim)!, { clean: !!p['clean'], eva: !!p['eva'] }) },
      ...(p['stage'] === 'search' ? [{
        until: (sim: import('../../../sim').Sim) => sim.world.query(InspectionC).some((v) => sim.world.get(v, InspectionC)?.phase === 'search'),
        what: 'inspectors searching', each: (sim: import('../../../sim').Sim) => void (sim.story.active = null),
      }] : []),
    ],
    hooks: [...(p['fight'] ? [{ name: 'inspect.fight' }] : []), ...(p['select'] ? [{ name: 'inspect.select' }] : [])],
    ui: { speed: 1 },
  }),
});
