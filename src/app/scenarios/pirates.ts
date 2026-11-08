import { playerShip, type Command, type Sim } from '../../sim';
import { patrolNode } from './patrol';
import type { Scenario } from './types';

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

/**
 * `?scenario=pirates[&faction=raiders][&hunt][&broke]` (#363): pirates interdict you mid-jump and hail you in the comms window. A fleet of the faction
 * (default the Scrapper Clans) waits at the next node and the ship jumps there: evade, bribe or fight. `&hunt`: hunters sent after you. `&broke`: too
 * few credits to bribe. The cartel only holds up travellers in its own space, so outside it `faction=cartel` passes you by.
 */
export const pirates: Scenario = ({ sim, params, dispatch, setSpeed }) => {
  const node = patrolNode(sim);
  if (!node) return;
  setSpeed(1);
  const opts = { faction: params.get('faction') ?? 'pirates', hunt: params.has('hunt'), broke: params.has('broke') };
  setTimeout(() => {
    for (const cmd of piratesCommands(sim, node, opts)) dispatch(cmd);
  }, 300);
};
