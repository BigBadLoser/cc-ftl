import { shuttleCalls, ShuttleCallC } from '../../../sim/galaxy/trafficCall';
import { InspectionC, inspections } from '../../../sim/inspect/types';
import type { Sim } from '../../../sim/sim';
import { definePreset, flag, oneOf } from '../types';

/** A station's shuttle is out calling at a trader, and (with a patrol) a patrol's inspectors are on their way to an NPC ship. */
const busy = (patrol: boolean) => (sim: Sim): boolean =>
  shuttleCalls(sim).some((id) => sim.world.get(id, ShuttleCallC)?.phase === 'out') &&
  (!patrol || inspections(sim).some((id) => sim.world.get(id, InspectionC)?.npc));

/**
 * `?scenario=business[&patrol]` (#603): NPC ships go about their business in the player's node. An asteroid field lies off the bow and a trading
 * outpost beside the ship; a Free Traders trader and miner turn up (the trader by the station, the miner by the field, as room allows): the station's
 * shuttle calls at the trader and the miner's pod goes out to mine. With `patrol` a navy patrol turns up too and inspects one of them.
 * `&stage=busy` (tests): built on until the shuttle is out and (with `patrol`) the inspection has started. The opening grace is skipped.
 */
export default definePreset({
  doc: 'The station\'s shuttle calls at a trader and an NPC miner works the field in the player\'s node; `patrol`: a navy patrol inspects them.',
  params: { patrol: flag(), stage: oneOf('busy') },
  spec: (p) => ({
    // A trading outpost beside the ship for the trader to call at (the start node may have none).
    node: { stations: [{ kind: 'station.trading', size: 'outpost', seed: 4 }] },
    steps: [
      { cmds: [{ type: 'story.skipGoals' as const }, { type: 'debug.spawnAsteroid' as const, kind: 'field' as const, seed: 7, x: 40, y: 150 }] },
      // The trader and the patrol first: a crowded node has room for the miner's small hulls where a freighter would not fit.
      {
        cmds: (ctx) => [
          { type: 'debug.pirates' as const, node: ctx.sim.galaxy.current, faction: 'traders', role: 'trader' as const },
          ...(p['patrol'] ? [{ type: 'debug.pirates' as const, node: ctx.sim.galaxy.current, faction: 'navy', role: 'patrol' as const }] : []),
          { type: 'debug.pirates' as const, node: ctx.sim.galaxy.current, faction: 'traders', role: 'miner' as const },
        ],
      },
      ...(p['stage'] === 'busy' ? [{ until: busy(!!p['patrol']), max: 12000, what: 'the shuttle calls and the inspection starts' }] : []),
    ],
    ui: { speed: 1 },
  }),
});
