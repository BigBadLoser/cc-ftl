import { galaxyIndex, nodeOf, playerShip, type Command, type Sim } from '../../sim';
import type { Scenario } from './types';

/** The node the scenario's hop goes to: the first neighbour with no structures (room for the patrol beside the ship), else the first. */
export function patrolNode(sim: Sim): string | undefined {
  const g = sim.galaxy;
  const near = (galaxyIndex(g).adjacent.get(g.current) ?? []).map((e) => (e.a === g.current ? e.b : e.a)).sort();
  return near.find((id) => !nodeOf(sim, id)?.structures.length) ?? near[0];
}

/** Stolen goods in the hold (unless `clean`), fuel and a full drive, a navy patrol waiting at `node`, and the jump there. */
export function patrolCommands(sim: Sim, node: string, opts: { clean?: boolean } = {}): Command[] {
  return [
    { type: 'debug.setCredits', value: 2000 },
    ...(opts.clean ? [] : [{ type: 'debug.giveItems' as const, item: 'item.stolen_goods', count: 12 }]),
    { type: 'debug.giveItems', item: 'item.fuel', count: 30 },
    { type: 'debug.chargeFtl' },
    { type: 'debug.patrol', node, faction: 'navy' },
    { type: 'galaxy.jump', ship: playerShip(sim), route: [node] },
  ];
}

/**
 * `?scenario=patrol[&clean]` (#138 step 2): a patrol hails you mid-jump. Stolen goods in the hold, a navy patrol at the next node and the jump there: the
 * patrol hails you to stop (the comms window). Comply and you drop out beside it and its inspectors come over once you deploy; run and you lose standing
 * and it may chase you. `&clean`: nothing aboard, so it only scans you in passing.
 */
export const patrol: Scenario = ({ sim, params, dispatch, setSpeed }) => {
  const node = patrolNode(sim);
  if (!node) return;
  setSpeed(1);
  setTimeout(() => {
    for (const cmd of patrolCommands(sim, node, { clean: params.has('clean') })) dispatch(cmd);
  }, 300);
};
