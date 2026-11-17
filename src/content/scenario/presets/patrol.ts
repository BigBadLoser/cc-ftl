import type { Sim } from '../../../sim';
import { untilInspectPhase } from '../lib/inspect';
import { patrolCommands, patrolNode } from '../lib/patrol';
import { definePreset, flag, oneOf } from '../types';

const clearDecision = (sim: Sim): void => void (sim.story.active = null);

/**
 * `?scenario=patrol[&clean][&fight]` (#138 step 2; `&fight`: attack the inspectors once they search, step 3): a patrol hails you mid-jump. Stolen goods in the
 * hold, a navy patrol at the next node and the jump there: the patrol hails you to stop (the comms window). Comply and you drop out beside it and its
 * inspectors come over once you deploy; run and you lose standing and it may chase you. `&clean`: nothing aboard, so it only scans you in passing.
 * `&stage=interdicted|search|settle` (tests): built until the patrol has stopped you, until you complied, deployed and its inspectors search, or until they wait for your answer.
 */
export default definePreset({
  doc: 'A navy patrol hails the contraband ship mid-jump.',
  params: { clean: flag(), fight: flag(), stage: oneOf('jumping', 'interdicted', 'search', 'settle') },
  spec: (p) => {
    const stage = p['stage'] ?? 'jumping';
    return {
      ship: { seed: 3 },
      node: { warm: 20 },
      steps: [
        { cmds: (ctx) => patrolCommands(ctx.sim, patrolNode(ctx.sim)!, { clean: !!p['clean'] }) },
        ...(stage === 'jumping' ? [] : [{ until: (sim: Sim) => sim.galaxy.travel?.phase === 'interdicted', max: 400, what: 'patrol interdicts', each: clearDecision }]),
        ...(stage !== 'search' && stage !== 'settle' ? [] : [
          { cmds: (ctx: { sim: Sim }) => [{ type: 'galaxy.respond' as const, encounter: ctx.sim.galaxy.encounters.find((x) => x.scan)!.id, choice: 'comply' as const }] },
          { cmds: [{ type: 'sector.deploy' as const, x: 0, y: 0 }], ticks: 0, ...untilInspectPhase('search') },
        ]),
        ...(stage === 'settle' ? [untilInspectPhase('settle')] : []),
      ],
      hooks: p['fight'] ? [{ name: 'inspect.fight' }] : [],
      ui: { speed: 1 },
    };
  },
});
