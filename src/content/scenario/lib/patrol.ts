import { galaxyIndex, nodeOf, playerShip, type Command, type Sim } from '../../../sim';

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
