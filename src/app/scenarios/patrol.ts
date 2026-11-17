import { patrolNode, patrolCommands } from '../../content/scenario/lib/patrol';

export { patrolNode, patrolCommands };
import type { Scenario } from './types';
import { fightWhenAboard } from './inspect';
import { afterTicks } from './wait';



/**
 * `?scenario=patrol[&clean][&fight]` (#138 step 2; `&fight`: attack the inspectors once they search, step 3): a patrol hails you mid-jump. Stolen goods in the hold, a navy patrol at the next node and the jump there: the
 * patrol hails you to stop (the comms window). Comply and you drop out beside it and its inspectors come over once you deploy; run and you lose standing
 * and it may chase you. `&clean`: nothing aboard, so it only scans you in passing.
 */
export const patrol: Scenario = ({ sim, params, dispatch, setSpeed }) => {
  const node = patrolNode(sim);
  if (!node) return;
  setSpeed(1);
  afterTicks(sim, 10, () => {
    for (const cmd of patrolCommands(sim, node, { clean: params.has('clean') })) dispatch(cmd);
    if (params.has('fight')) fightWhenAboard(sim, dispatch);
  });
};
