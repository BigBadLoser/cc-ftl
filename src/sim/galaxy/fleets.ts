import type { Sim } from '../sim';
import { isLive } from '../trade/deals';
import { catchUp, stepAgenda } from './agenda';
import { liftFleet, materialiseFleet, strandIfCrippled } from './fleetShips';
import { nodesWithin } from './graph';
import { portNode } from './ports';
import { rebuildPorts } from './rebuild';
import { FLEET_AREA_HOPS, SENSOR_HOPS } from './tuning';
import type { Fleet } from './types';

export { nodesWithin } from './graph';

/**
 * The NPC population in motion (user decisions 2026-10-22). Fleets are persistent: created with their home port (roster.ts), they follow their agenda
 * one hop per turn (agenda.ts) and are the same ships that show up in a node the player is in (fleetShips.ts). Everything here is a pure function
 * of the galaxy seed, the turn number and the galaxy state, so a run and a save continuation agree.
 *
 * Only the area near the player is simulated: a fleet is stepped while its node or its home is within FLEET_AREA_HOPS jumps of the player's node.
 * The rest are frozen (`Fleet.synced` stays behind) and `syncFleets` plays them forward with `catchUp` when the player comes near.
 */

/** Nodes the player's sensors cover: within SENSOR_HOPS jumps of the current node. Fleets elsewhere are not shown. */
export const sensorNodes = (sim: Sim): Map<string, number> => nodesWithin(sim, sim.galaxy.current, SENSOR_HOPS);

/** The fleets the player's sensors can see, ascending id. */
export const visibleFleets = (sim: Sim): Fleet[] => {
  const seen = sensorNodes(sim);
  return sim.galaxy.fleets.filter((f) => seen.has(f.node));
};

/** Is the fleet in the simulated area: it, or its home port, is within reach of the player? */
const simulated = (f: Fleet, area: ReadonlyMap<string, number>): boolean => area.has(f.node) || area.has(portNode(f.home));

/** Bring every simulated fleet and port up to `turn` (played forward, nothing else). Called when the player arrives and at the start of each turn. */
export function syncFleets(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy) return;
  const area = nodesWithin(sim, g.current, FLEET_AREA_HOPS);
  for (const f of g.fleets) if (f.synced < turn && simulated(f, area)) catchUp(sim, f, turn);
  rebuildPorts(sim, turn, area);
}

/** A fight or a deal in the player's node keeps the fleets there in place. */
const holdsFleets = (sim: Sim): boolean => sim.sector.inCombat || sim.trade.deals.some(isLive);

/**
 * One turn of traffic: fleets that were frozen catch up to the previous turn, then every simulated fleet takes a step (unless held in the player's
 * node by a fight or a deal), and ports that are due build replacements. When the player's node is live ('active') a fleet that leaves it has its ships
 * lifted out and one that arrives has them materialised there; a fleet whose ship was crippled there is stranded first.
 */
export function stepFleets(sim: Sim, turn: number): void {
  const g = sim.galaxy;
  if (!sim.content.galaxy) return;
  const live = sim.sector.state === 'active';
  syncFleets(sim, turn - 1);
  const area = nodesWithin(sim, g.current, FLEET_AREA_HOPS);
  const hold = holdsFleets(sim);
  for (const f of g.fleets) {
    if (f.synced >= turn || !simulated(f, area)) continue;
    const here = live && f.node === g.current;
    if (here) strandIfCrippled(sim, f, turn);
    if (here && hold) {
      f.from = f.node;
      f.synced = turn;
      continue;
    }
    stepAgenda(sim, f, turn);
    if (here && f.node !== g.current) liftFleet(sim, f);
    else if (live && !here && f.node === g.current) materialiseFleet(sim, f);
  }
  rebuildPorts(sim, turn, area);
  g.rev++;
}

