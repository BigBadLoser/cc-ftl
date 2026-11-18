import { playerShip, type Command, type Sim } from '../../../sim';


/** Credits, fuel and a full drive, a pirate fleet waiting at `node` (hunters with `hunt`), and the jump there. */
export function piratesCommands(sim: Sim, node: string, opts: { faction?: string; hunt?: boolean; broke?: boolean } = {}): Command[] {
  return [
    { type: 'story.skipGoals' },
    { type: 'debug.setCredits', value: opts.broke ? 5 : 2000 },
    { type: 'debug.giveItems', item: 'item.fuel', count: 30 },
    { type: 'debug.chargeFtl' },
    { type: 'debug.pirates', node, faction: opts.faction ?? 'pirates', ...(opts.hunt ? { hunt: true } : {}) },
    { type: 'galaxy.jump', ship: playerShip(sim), route: [node] },
  ];
}
