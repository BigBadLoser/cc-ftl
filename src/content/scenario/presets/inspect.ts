import { inspectCommands, inspectStation, untilInspectPhase } from '../lib/inspect';
import { definePreset, flag, oneOf } from '../types';

/**
 * `?scenario=inspect[&clean][&eva][&fight][&select]` (#138 step 1; `&fight` and `&select` step 3): a contraband inspection at a station. A navy-run trading
 * outpost beside the ship, stolen goods in the hold (`&clean`: none), and the station hailed: its inspectors come over by shuttle, search the holds, carry
 * the goods off and wait for an answer (the alert). `&eva`: the ship's airlocks are switched off, so they cross in suits and wait on the hull until one
 * is switched back on. `&stage=search|settle` (tests): built on until the inspectors are aboard and searching, or waiting for the answer.
 */
export default definePreset({
  doc: 'A navy station hails the contraband ship: inspectors come over and search.',
  params: { clean: flag(), eva: flag(), fight: flag(), select: flag(), stage: oneOf('hailed', 'search', 'settle') },
  spec: (p) => ({
    ship: { seed: 3 },
    node: { warm: 20, stations: [{ kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy', frame: true }] },
    steps: [
      { cmds: (ctx) => inspectCommands(ctx.sim, inspectStation(ctx.sim)!, { clean: !!p['clean'], eva: !!p['eva'] }) },
      ...(p['stage'] === 'search' || p['stage'] === 'settle' ? [untilInspectPhase('search')] : []),
      ...(p['stage'] === 'settle' ? [untilInspectPhase('settle')] : []),
    ],
    hooks: [...(p['fight'] ? [{ name: 'inspect.fight' }] : []), ...(p['select'] ? [{ name: 'inspect.select' }] : [])],
    ui: { speed: 1 },
  }),
});
